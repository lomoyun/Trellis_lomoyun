import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { bindSession, checkpoint, context, createSession, createTask, readSession, readTask, readTrace, updateTask } from "@trellis-lite/core";
import { git } from "../src/git.js";

let base: string;
beforeEach(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), "tll-devices-")); });
afterEach(async () => { await fs.promises.rm(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });

function identity(root: string, name: string): void {
  git(root, ["config", "user.name", name]);
  git(root, ["config", "user.email", `${name}@example.test`]);
}

it("merges independent session traces across clones while surfacing PRD conflicts", () => {
  const remote = path.join(base, "remote.git");
  const a = path.join(base, "alice");
  const b = path.join(base, "bob");
  git(base, ["init", "--bare", "--initial-branch=main", remote]);
  git(base, ["clone", remote, a]);
  identity(a, "alice");
  const task = createTask(a, { id: "portable", title: "Portable", actor: "alice", prd: "## Acceptance\nOriginal acceptance\n" });
  git(a, ["add", "--", ".trellis"]);
  git(a, ["commit", "-qm", "fixture"]);
  git(a, ["push", "origin", "main"]);
  git(base, ["clone", remote, b]);
  identity(b, "bob");
  const alice = bindSession(a, createSession(a, { human: "alice", platform: "codex" }).id, "portable");
  const bob = bindSession(b, createSession(b, { human: "bob", platform: "claude" }).id, "portable");
  for (const [root, session] of [[a, alice], [b, bob]] as const) {
    checkpoint(root, "portable", { session, input: { schemaVersion: 1, key: session.id, type: "checkpoint", summary: "Independent work", expectedRevision: task.revision } });
    git(root, ["add", "--", ".trellis/tasks/portable/trace"]);
    git(root, ["commit", "-qm", "trace"]);
  }
  git(a, ["push", "origin", "main"]);
  git(b, ["fetch", "origin"]);
  git(b, ["merge", "--no-edit", "origin/main"]);
  expect(readTrace(b, "portable")).toHaveLength(2);
  expect(git(b, ["ls-files", ".trellis/.local"])).toBe("");
  expect(() => readSession(b, alice.id)).toThrow("Create a local session");
  expect(context(b).task).toBeUndefined();
  git(b, ["push", "origin", "main"]);
  git(a, ["pull", "--ff-only"]);
  for (const root of [a, b]) {
    updateTask(root, "portable", { expectedRevision: readTask(root, "portable").revision, prd: `## Acceptance\nChanged by ${path.basename(root)}\n` });
    git(root, ["add", "--", ".trellis/tasks/portable/task.md"]);
    git(root, ["commit", "-qm", "edit acceptance"]);
  }
  git(a, ["push", "origin", "main"]);
  git(b, ["fetch", "origin"]);
  expect(() => git(b, ["merge", "--no-edit", "origin/main"])).toThrow();
  expect(git(b, ["diff", "--name-only", "--diff-filter=U"])).toBe(".trellis/tasks/portable/task.md");
}, 60_000);
