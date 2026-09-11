import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { applyMigration, createTask, directoryMigration, hash, json, planMigration, readText, recover, writeAtomic } from "../src/index.js";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "tll-namespace-")); });
afterEach(async () => { await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 10 }); });

it("previews without writes and preserves binary attachments and historical trace bytes", () => {
  writeAtomic(root, ".trellis/tasks/old/task.json", json({ title: "Old task" }));
  const trace = '{"snapshotPath":".trellis/tasks/old/prd.md"}\r\n';
  writeAtomic(root, ".trellis/tasks/old/trace/history.jsonl", trace);
  const bytes = Buffer.from([0, 255, 128, 10, 13]);
  fs.writeFileSync(path.join(root, ".trellis/tasks/old/asset.bin"), bytes);
  expect(directoryMigration(root).applied).toBe(false);
  expect(fs.existsSync(path.join(root, ".tll"))).toBe(false);
  expect(directoryMigration(root, true).applied).toBe(true);
  expect(fs.existsSync(path.join(root, ".trellis"))).toBe(false);
  expect(readText(root, ".tll/tasks/old/trace/history.jsonl")).toBe(trace);
  expect(fs.readFileSync(path.join(root, ".tll/tasks/old/asset.bin"))).toEqual(bytes);
  applyMigration(root, planMigration(root));
  expect(readText(root, ".tll/tasks/old/task.json")).toContain('"schemaVersion": 1');
});

it("refuses collisions and does not initialize a second active namespace", () => {
  writeAtomic(root, ".trellis/project.md", "keep");
  expect(() => createTask(root, { id: "new", title: "New", actor: "alice" })).toThrow("Old .trellis");
  expect(fs.existsSync(path.join(root, ".tll"))).toBe(false);
  writeAtomic(root, ".tll/project.md", "another");
  expect(() => directoryMigration(root, true)).toThrow("Both .trellis and .tll");
  expect(readText(root, ".trellis/project.md")).toBe("keep");
  expect(readText(root, ".tll/project.md")).toBe("another");
});

it("refuses old locks and pending transactions", () => {
  writeAtomic(root, ".trellis/.local/locks/project.lock", "busy");
  expect(() => directoryMigration(root, true)).toThrow("Old write locks");
  fs.unlinkSync(path.join(root, ".trellis/.local/locks/project.lock"));
  writeAtomic(root, ".trellis/.local/transactions/old.json", json({ state: "pending" }));
  expect(() => directoryMigration(root, true)).toThrow("Recover old transactions");
});

it("does not replay pre-rename transactions into the old namespace", () => {
  writeAtomic(root, ".trellis/project.md", "after");
  writeAtomic(root, ".trellis/.local/transactions/old.json", json({ schemaVersion: 1, id: "old", state: "applied", changes: [{ path: ".trellis/project.md", before: "before", after: "after" }] }));
  directoryMigration(root, true);
  expect(() => recover(root, "old", true)).toThrow("Historical .trellis transaction");
  expect(fs.existsSync(path.join(root, ".trellis"))).toBe(false);
  expect(readText(root, ".tll/project.md")).toBe("after");
});

it("retains customized Lite configuration while changing its product identity", () => {
  const config = 'schemaVersion: 1\nproduct: "trellis-lite"\ncontextBudget: 2048\ncustom: keep\n';
  writeAtomic(root, ".trellis/config.yaml", config);
  directoryMigration(root, true);
  applyMigration(root, planMigration(root));
  expect(readText(root, ".tll/config.yaml")).toContain("product: tll");
  expect(readText(root, ".tll/config.yaml")).toContain("contextBudget: 2048");
  expect(readText(root, ".tll/config.yaml")).toContain("custom: keep");
  expect(readText(root, ".tll/history/legacy-config.yaml")).toBe(config);
});

it("refuses junctions inside the old tree without moving or touching their targets", () => {
  writeAtomic(root, ".trellis/project.md", "old");
  writeAtomic(root, "outside/keep.txt", "keep");
  fs.symlinkSync(path.join(root, "outside"), path.join(root, ".trellis/linked"), process.platform === "win32" ? "junction" : "dir");
  expect(() => directoryMigration(root, true)).toThrow("Symlink refused");
  expect(readText(root, "outside/keep.txt")).toBe("keep");
  expect(fs.existsSync(path.join(root, ".tll"))).toBe(false);
});

it("resolves old ownership manifest paths after renaming the directory", () => {
  writeAtomic(root, ".trellis/scripts/context.py", "old runtime");
  writeAtomic(root, ".trellis/.template-hashes.json", json({ hashes: { ".trellis/scripts/context.py": hash("old runtime") } }));
  directoryMigration(root, true);
  const plan = planMigration(root);
  expect(plan.conflicts).toEqual([]);
  const tx = applyMigration(root, plan);
  expect(readText(root, ".tll/scripts/context.py")).toBeNull();
  recover(root, tx.id, true);
  expect(readText(root, ".tll/scripts/context.py")).toBe("old runtime");
});
