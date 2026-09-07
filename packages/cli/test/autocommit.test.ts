import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterEach, expect, it } from "vitest";
import { bindSession, checkpoint, createSession, createTask, readTrace, writeAtomic, type Session, type TraceEvent } from "@trellis-lite/core";
import { autoCommit, attributeFiles } from "../src/autocommit.js";
import { git, gitHead, stagedPaths } from "../src/git.js";
import { grantPolicy, revokePolicy } from "../src/policy.js";
import { install } from "../src/templates.js";

let root: string;
let session: Session;
let event: TraceEvent;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "tll-commit-"));
  git(root, ["init", "-q"]);
  git(root, ["config", "user.name", "Alice"]);
  git(root, ["config", "user.email", "alice@example.test"]);
  install(root);
  const task = createTask(root, { id: "demo", title: "Task", actor: "Alice" });
  session = bindSession(root, createSession(root, { human: "Alice", platform: "codex" }).id, "demo");
  git(root, ["add", "--", "AGENTS.md", ".trellis"]);
  git(root, ["commit", "-qm", "fixture"]);
  event = checkpoint(root, "demo", { session, input: { schemaVersion: 1, key: "first", type: "checkpoint", summary: "First checkpoint", expectedRevision: task.revision } });
});
afterEach(async () => { await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });

function authorize(scope = "records"): void {
  grantPolicy(root, { scope, duration: "session", session: session.id, ack: "allow-local-commits" });
}

it("is off by default and revocation disables commits", () => {
  const head = gitHead(root);
  expect(autoCommit(root, event, { session }).status).toBe("off");
  authorize();
  revokePolicy(root);
  expect(autoCommit(root, event, { session }).status).toBe("off");
  expect(gitHead(root)).toBe(head);
});

it("commits only this task's records, never unrelated work or local permissions", () => {
  authorize();
  writeAtomic(root, "unrelated.txt", "user work");
  expect(autoCommit(root, event, { session }).status).toBe("committed");
  expect(git(root, ["show", "--pretty=format:", "--name-only", "HEAD"])).toBe(`.trellis/tasks/demo/trace/${session.id}.jsonl`);
  expect(git(root, ["ls-files", ".trellis/.local"])).toBe("");
  expect(git(root, ["status", "--porcelain"])).toContain("unrelated.txt");
});

it("does not touch pre-existing staged changes", () => {
  authorize();
  writeAtomic(root, "user.txt", "staged user work");
  git(root, ["add", "--", "user.txt"]);
  const before = git(root, ["diff", "--cached"]);
  expect(autoCommit(root, event, { session }).status).toBe("skipped");
  expect(git(root, ["diff", "--cached"])).toBe(before);
});

it("skips initially dirty/mixed code files", () => {
  authorize("task");
  writeAtomic(root, "code.ts", "user edit before task");
  attributeFiles(root, session, ["code.ts"]);
  writeAtomic(root, "code.ts", "user and agent edits");
  expect(autoCommit(root, event, { session, files: ["code.ts"] }).status).toBe("skipped");
  expect(stagedPaths(root)).toEqual([]);
});

it("commits explicitly attributed files that were absent at task start", () => {
  authorize("task");
  attributeFiles(root, session, ["new-code.ts"]);
  writeAtomic(root, "new-code.ts", "export const value = 1;\n");
  expect(autoCommit(root, event, { session, files: ["new-code.ts"] }).status).toBe("committed");
  expect(git(root, ["show", "--pretty=format:", "--name-only", "HEAD"])).toContain("new-code.ts");
});

it("preserves checkpoint and allows retry after commit-hook failure", () => {
  authorize();
  const hookDir = path.join(root, "test-hooks");
  fs.mkdirSync(hookDir);
  fs.writeFileSync(path.join(hookDir, "pre-commit"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  git(root, ["config", "core.hooksPath", hookDir]);
  const head = gitHead(root);
  expect(autoCommit(root, event, { session }).status).toBe("failed");
  expect(readTrace(root, "demo")).toHaveLength(1);
  expect(gitHead(root)).toBe(head);
  git(root, ["config", "--unset", "core.hooksPath"]);
  expect(autoCommit(root, event, { session }).status).toBe("committed");
});
