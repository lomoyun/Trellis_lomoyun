import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterEach, it, expect } from "vitest";
import { applyMigration, hash, json, nativeAdvice, planMigration, readTask, readText, recover, writeAtomic } from "../src/index.js";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "tll-migrate-")); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

it("migrates legacy metadata and plan, preserves attachments and can roll back exact bytes", () => {
  const original = json({ title: "old", status: "in_progress", assignee: "alice", parent: "parent-task", unknown: 42 });
  writeAtomic(root, ".trellis/tasks/old/task.json", original);
  writeAtomic(root, ".trellis/tasks/old/prd.md", "## Acceptance\nKeep all data\n");
  writeAtomic(root, ".trellis/tasks/old/implement.md", "- [ ] S1: Keep stable\n");
  writeAtomic(root, ".trellis/tasks/old/research/note.md", "keep");
  const plan = planMigration(root);
  expect(readText(root, ".trellis/tasks/old/task.json")).toBe(original);
  const tx = applyMigration(root, plan);
  const task = readTask(root, "old");
  expect(task.format).toBe("standard");
  expect(task.meta.status).toBe("doing");
  expect(task.meta.parent).toBe("parent-task");
  expect(task.meta.unknown).toBe(42);
  expect(task.plan).toBe("- [ ] S1: Keep stable\n");
  expect(planMigration(root).changes).toEqual([]);
  recover(root, tx.id, true);
  expect(readText(root, ".trellis/tasks/old/task.json")).toBe(original);
  expect(readText(root, ".trellis/tasks/old/research/note.md")).toBe("keep");
});

it("refuses conflicting plans without writing files", () => {
  writeAtomic(root, ".trellis/tasks/old/task.json", json({ title: "old" }));
  writeAtomic(root, ".trellis/tasks/old/implement.md", "one");
  writeAtomic(root, ".trellis/tasks/old/plan.md", "two");
  const plan = planMigration(root);
  expect(plan.conflicts).toHaveLength(1);
  expect(() => applyMigration(root, plan)).toThrow("differ");
  expect(readTask(root, "old").format).toBe("legacy");
});

it("preserves custom hook siblings", () => {
  writeAtomic(root, ".claude/settings.json", json({ theme: "dark", hooks: { SessionStart: [{ hooks: [{ type: "command", command: "python .claude/hooks/session-start.py" }] }, { hooks: [{ type: "command", command: "echo custom" }] }] } }));
  applyMigration(root, planMigration(root));
  const value = JSON.parse(readText(root, ".claude/settings.json") ?? "null");
  expect(value.theme).toBe("dark");
  expect(value.hooks.SessionStart).toEqual([{ hooks: [{ type: "command", command: "echo custom" }] }]);
});

it("never creates native goals or allows plan-mode writes", () => {
  expect(nativeAdvice({}).goal).toContain("Do not create");
  expect(nativeAdvice({ mode: "plan", goalRequested: true }).readOnly).toBe(true);
  expect(nativeAdvice({ mode: "plan", goalRequested: true }).goal).toContain("do not create");
  expect(nativeAdvice({ goalRequested: true, existingGoal: "another" }).goal).toContain("do not replace");
  expect(nativeAdvice({ confirmedPlan: true }).plan).toContain("verbatim");
  expect(nativeAdvice({}).taskCompletion).toBe("explicit-finish-only");
});

it("preserves custom commands within a mixed hook group and similarly named user scripts", () => {
  const custom = { type: "command", command: "python my-hooks/session-start.py" };
  writeAtomic(root, ".claude/settings.json", json({ hooks: { SessionStart: [{ matcher: "startup", hooks: [{ type: "command", command: "python .claude/hooks/session-start.py" }, custom] }] } }));
  applyMigration(root, planMigration(root));
  const value = JSON.parse(readText(root, ".claude/settings.json") ?? "null");
  expect(value.hooks.SessionStart).toEqual([{ matcher: "startup", hooks: [custom] }]);
});

it("detaches the legacy Pi extension without touching custom extensions", () => {
  writeAtomic(root, ".pi/settings.json", json({ extensions: ["./extensions/trellis/index.ts", "./extensions/custom/index.ts"], theme: "custom" }));
  applyMigration(root, planMigration(root));
  expect(JSON.parse(readText(root, ".pi/settings.json") ?? "null")).toEqual({ extensions: ["./extensions/custom/index.ts"], theme: "custom" });
});

it("refuses to delete runtime dependencies when another platform still needs manual detachment", () => {
  writeAtomic(root, ".gemini/hooks/session-start.py", "custom host wrapper");
  writeAtomic(root, ".trellis/scripts/context.py", "old runtime");
  writeAtomic(root, ".trellis/.template-hashes.json", json({ __version: 2, hashes: { ".gemini/hooks/session-start.py": hash("custom host wrapper"), ".trellis/scripts/context.py": hash("old runtime") } }));
  const plan = planMigration(root);
  expect(plan.conflicts).toContain("Manual platform detachment required: .gemini");
  expect(() => applyMigration(root, plan)).toThrow("Manual platform detachment");
  expect(readText(root, ".trellis/scripts/context.py")).toBe("old runtime");
});
