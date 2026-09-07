import { hash, handoffPath, json, object, readText, relativeKey, safeName, withLock, writeAtomic, type Session, type TraceEvent } from "@trellis-lite/core";
import { git, gitHead, stagedPaths } from "./git.js";
import { policyApplies, readPolicy } from "./policy.js";

interface Attribution { baseHead: string | null; files: Record<string, { clean: boolean }> }
export interface CommitResult { status: "off" | "skipped" | "committed" | "failed"; reason?: string; commit?: string; files?: string[] }

export function attributeFiles(root: string, session: Session, files: string[]): void {
  const attribution: Attribution = { baseHead: gitHead(root), files: {} };
  for (const name of files) {
    const key = relativeKey(name);
    if (key.startsWith(".trellis/")) continue;
    attribution.files[key] = { clean: git(root, ["status", "--porcelain", "--", key]) === "" || readText(root, key) === null };
  }
  withLock(root, "project", () => writeAtomic(root, attributionPath(session.id), json(attribution)));
}

function attributionPath(session: string): string {
  return `.trellis/.local/attribution/${safeName(session)}.json`;
}

function codeFiles(root: string, session: Session, requested: string[]): string[] | null {
  if (!requested.length) return [];
  const text = readText(root, attributionPath(session.id));
  if (text === null) return null;
  const data = object(JSON.parse(text));
  if (data.baseHead !== gitHead(root)) return null;
  const files = object(data.files);
  const keys = requested.map(relativeKey);
  return keys.every((key) => !key.startsWith(".trellis/") && object(files[key]).clean === true) ? keys : null;
}

function snapshotMatches(root: string, event: TraceEvent): boolean {
  return Object.entries(event.snapshots).every(([key, content]) => {
    const current = readText(root, key);
    return current !== null && hash(current) === hash(content);
  });
}

function commitFiles(root: string, files: string[], event: TraceEvent): CommitResult {
  const before = Object.fromEntries(files.map((key) => [key, readText(root, key)]));
  git(root, ["add", "--", ...files]);
  if (!files.every((key) => readText(root, key) === before[key])) return { status: "skipped", reason: "Files changed during staging; review the index", files };
  if (!stagedPaths(root).length) return { status: "skipped", reason: "No changes to commit" };
  try {
    git(root, ["commit", "--only", "-m", `chore(trace): 记录${event.type}检查点`, "--", ...files]);
    return { status: "committed", commit: gitHead(root) ?? undefined, files };
  } catch (error) {
    // 保留记录和已暂存文件；重试凭据只认可本次路径和字节。
    writeAtomic(root, `.trellis/.local/commit-retries/${event.id}.json`, json({ files: before }));
    return { status: "failed", reason: String(error), files };
  }
}

function retryOwnIndex(root: string, event: TraceEvent, staged: string[]): boolean {
  const raw = readText(root, `.trellis/.local/commit-retries/${event.id}.json`);
  if (raw === null) return false;
  const files = object(object(JSON.parse(raw)).files);
  return staged.every((key) => key in files && readText(root, key) === files[key] && git(root, ["diff", "--name-only", "--", key]) === "");
}

export function autoCommit(root: string, event: TraceEvent, options: { session: Session; files?: string[] }): CommitResult {
  try {
    const policy = readPolicy(root);
    if (!policy || !policyApplies(policy, options.session, event.task)) return { status: "off" };
    return withLock(root, "project", () => {
      if (git(root, ["diff", "--name-only", "--diff-filter=U"])) return { status: "skipped", reason: "Merge conflicts exist" };
      const staged = stagedPaths(root);
      if (staged.length && !retryOwnIndex(root, event, staged)) return { status: "skipped", reason: "Pre-existing staged changes; index left untouched" };
      if (!snapshotMatches(root, event)) return { status: "skipped", reason: "Task changed after checkpoint" };
      const code = policy.scope === "task" ? codeFiles(root, options.session, options.files ?? []) : [];
      if (code === null) return { status: "skipped", reason: "Code ownership is ambiguous or base HEAD changed" };
      const trace = `.trellis/tasks/${event.task}/trace/${event.session}.jsonl`;
      const files = [...Object.keys(event.snapshots), trace, ...code];
      if (event.type === "handoff") files.push(handoffPath(event));
      return commitFiles(root, files, event);
    });
  } catch (error) { return { status: "failed", reason: String(error) }; }
}
