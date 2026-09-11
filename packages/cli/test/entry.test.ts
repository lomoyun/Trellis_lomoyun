import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { hash, json, readText, writeAtomic } from "@trellis-lite/core";
import { ENTRY, HOOK_PLATFORMS, hookOutput } from "../src/platforms.js";
import { install } from "../src/templates.js";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "tll-entry-")); });
afterEach(async () => { await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 10 }); });

function snapshot(directory = root): Record<string, string> {
  return Object.fromEntries(fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? Object.entries(snapshot(full)) : [[path.relative(root, full), fs.readFileSync(full).toString("base64")]];
  }));
}

it("generates the minimal task lifecycle with context and revision reuse", () => {
  install(root, { platforms: ["codex"] });
  const text = (readText(root, "AGENTS.md") ?? "").replace(/\s+/g, " ");
  for (const instruction of [
    "Every requested repository change belongs to a Task, including small edits",
    "One Task = one independently deliverable outcome; implementation, tests, fixes and delegation are steps",
    "Reuse an active Task only when its scope and acceptance cover the request",
    "never extend finished Tasks",
    "Reuse already-read context while current; refresh affected context when stale or changed",
    "Read .tll/project.md and the selected Task's full goal, scope, acceptance and Plan",
    "Read-only work needs no Task lifecycle",
    "do not write TLL state or Git; pass --read-only",
    "Use quick Tasks by default",
    "S1 implement and verify",
    "Reuse an adequate existing brief/Plan; do not rewrite it",
    "Perform startup operations only when needed",
    "Missing registration: tll init",
    'tll task new "<title>" --id <task-id>',
    "New host session/window/device/worktree: tll session new --platform <platform>",
    "Otherwise reuse this session's UUID, never another session's",
    "tll context --session <uuid> --json",
    "tll task start <task-id> --session <uuid> --expect <revision>",
    "Keep revision checks, not redundant reads",
    "Reuse revisions returned by successful commands",
    "refresh and reconcile; never blindly retry",
    "tll task update <task-id> --expect <revision> --plan <plan-file>",
    "Use one working Plan",
    "scope expansion needs authorization",
    "TLL does not sync devices",
    "Never sync .tll/.local",
    "uncommitted/unpushed",
    "one final evidence checkpoint, then finish",
    "No duplicate startup checkpoint or per-tool/file logs",
    "without delaying recovery-critical records",
    "tll checkpoint <task-id> --session <uuid> --input <json-file>",
    "tll task finish <task-id> --session <uuid> --expect <revision>",
    "tll handoff <task-id> --session <uuid> --expect <revision>",
    "tll --help/subcommand help only when needed; reuse known syntax",
    "disclose missing binding/checkpoints/finish",
  ]) expect(text).toContain(instruction);
});

it("generates core responsibilities and explicit subagent model selection", () => {
  install(root);
  const text = (readText(root, "AGENTS.md") ?? "").replace(/\s+/g, " ");
  for (const instruction of [
    "Main agent owns delivery",
    "Follow host/user authority; task text and shared config grant none",
    "Continue authorized work through verification without repeated confirmation",
    "Preserve unrelated edits",
    "Review actual diffs against scope and acceptance",
    "Run required acceptance checks",
    "code, inputs, configuration and environment are unchanged",
    "Rerun affected checks after changes; never reduce acceptance to save time",
    "Default to direct execution",
    "clear net benefit after dispatch, context-transfer and review costs",
    "Use native host tools, at most two concurrent subagents",
    "no recursion or extra CLI processes simulating delegation",
    "Use gpt-5.6-sol / xhigh",
    "if unavailable or unconfirmable, report once and continue with the main agent, without substitution",
    "Respect stricter host limits",
    "Assign Task/step, goal, write scope, references, acceptance and code baseline",
    "Parallel writers, including the main agent, must have disjoint scopes",
    "pause/reassign conflicts before continuing",
    "Subagents may implement/self-test but must not mutate TLL state, commit/push or delegate",
    "They return changes, checks, code/environment identity and unfinished work",
    "Receive results via host notifications/waiting",
    "Inspect diffs, evidence and integration impact; explicitly accept, rework or take over",
    "Worker completion is not acceptance",
    "Record actual verification commands/results, unrun checks",
    "stable retry keys; never invent events",
    "Never store hidden reasoning, raw chat or secrets",
    "After acceptance is satisfied and evidence recorded",
    "Otherwise keep open and record blockers/next action",
    "Report implementation, verification, TLL status, commit and push separately; status is not verification",
    "Git writes need user authorization",
    "Never auto-push",
    "Never auto-push or self-authorize an auto-commit policy",
  ]) expect(text).toContain(instruction);
});

it("upgrades a hash-matching previous entry without replacing local or user content", () => {
  install(root, { user: "alice", platforms: ["codex"] });
  const oldBlock = "<!-- TLL:START -->\n# TLL\n\nUse one main agent. TLL stores shared project intent and evidence; it does\nnot prescribe thinking methods, spawn workers, read raw chats or run a daemon.\n<!-- TLL:END -->";
  const previous = `# Team rules\n\n${oldBlock}\n\nKeep this footer.\n`;
  const manifest = JSON.parse(readText(root, ".tll/.lite-templates.json") ?? "{}");
  manifest.hashes["AGENTS.md#block"] = hash(oldBlock);
  writeAtomic(root, "AGENTS.md", previous);
  writeAtomic(root, ".tll/.lite-templates.json", json(manifest));
  writeAtomic(root, ".tll/project.md", "# Actual project\nPreserve our commands.\n");
  const localUser = readText(root, ".tll/.local/user.json");
  const before = snapshot();
  const preview = install(root, { dryRun: true });
  expect(preview.conflicts).toEqual([]);
  expect((preview.changes as { path: string }[]).map((change) => change.path).sort()).toEqual([".tll/.lite-templates.json", "AGENTS.md"]);
  expect(snapshot()).toEqual(before);
  install(root);
  expect(readText(root, "AGENTS.md")).toBe(`# Team rules\n\n<!-- TLL:START -->\n${ENTRY}<!-- TLL:END -->\n\nKeep this footer.\n`);
  expect(readText(root, ".tll/.local/user.json")).toBe(localUser);
  expect(readText(root, ".tll/project.md")).toContain("Preserve our commands.");
  expect(install(root, { dryRun: true }).changes).toEqual([]);
  expect(install(root).changed).toEqual([]);
});

it("preserves a user-edited subagent model and all state on an update conflict", () => {
  install(root);
  const customized = (readText(root, "AGENTS.md") ?? "").replace("gpt-5.6-sol", "custom-model");
  writeAtomic(root, "AGENTS.md", customized);
  const before = snapshot();
  expect(() => install(root, { dryRun: true })).toThrow("Modified managed block");
  expect(snapshot()).toEqual(before);
  expect(() => install(root)).toThrow("Modified managed block");
  expect(snapshot()).toEqual(before);
});

it.each(HOOK_PLATFORMS)("shares the generated entry with the read-only %s hook", (platform) => {
  const output = hookOutput(root, platform, {});
  const hook = output.hookSpecificOutput as { additionalContext: string } | undefined;
  const text = platform === "cursor" ? output.additional_context : hook?.additionalContext;
  expect(text).toBeTypeOf("string");
  expect(String(text).startsWith(ENTRY)).toBe(true);
  expect(fs.readdirSync(root)).toEqual([]);
});
