import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterEach, expect, it } from "vitest";
import { bindSession, checkpoint, context, createSession, createTask, readTask, readText, relativeKey, writeAtomic } from "../src/index.js";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "tll-safety-")); });
afterEach(async () => { await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 10 }); });

it.each(["../outside", "a/../../outside", "C:/outside", "//server/share", ".git/config", "folder/.GIT/index", "bad\u0000name"])("rejects escaping or reserved path %s", (key) => {
  expect(() => relativeKey(key)).toThrow();
});

it("rejects symlink/junction escape without changing the target", () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "tll-outside-"));
  try {
    fs.mkdirSync(path.join(root, ".tll"));
    fs.symlinkSync(outside, path.join(root, ".tll/tasks"), "junction");
    expect(() => createTask(root, { title: "escape", actor: "alice" })).toThrow("Symlink refused");
    expect(fs.readdirSync(outside)).toEqual([]);
  } finally { fs.rmSync(outside, { recursive: true, force: true }); }
});

it("keeps state files intact on invalid schema and refuses an altered identity", () => {
  const task = createTask(root, { id: "stable", title: "A", actor: "alice" });
  const key = `${task.directory}/task.md`;
  const changed = Object.values(task.files)[0].replace("id: stable", "id: different");
  writeAtomic(root, key, changed);
  expect(() => readTask(root, "stable")).toThrow("identity");
  expect(readText(root, key)).toBe(changed);
});

it("uses the configured context budget without writing local state", () => {
  writeAtomic(root, ".tll/config.yaml", "schemaVersion: 1\nproduct: tll\ncontextBudget: 1024\n");
  writeAtomic(root, ".tll/project.md", "x".repeat(10000));
  expect(context(root).sections[0].omitted).toContain("Budget");
  expect(fs.existsSync(path.join(root, ".tll/.local"))).toBe(false);
});

it("treats re-ordered JSON fields as the same idempotent request", () => {
  const task = createTask(root, { title: "A", actor: "alice" });
  const session = bindSession(root, createSession(root, { human: "alice", platform: "codex" }).id, task.meta.id);
  const first = checkpoint(root, task.meta.id, { session, input: { schemaVersion: 1, key: "same", summary: "same", type: "checkpoint", expectedRevision: task.revision, evidence: { command: "test", result: "passed" } } });
  const second = checkpoint(root, task.meta.id, { session, input: { key: "same", schemaVersion: 1, expectedRevision: task.revision, type: "checkpoint", summary: "same", evidence: { result: "passed", command: "test" } } });
  expect(second.id).toBe(first.id);
});
