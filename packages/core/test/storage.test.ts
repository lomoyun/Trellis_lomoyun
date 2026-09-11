import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bindSession, checkpoint, context, createSession, createTask, expandTask, hash, readTask, readText, readTrace, recover, updateTask, writeAtomic, type CheckpointInput } from "../src/index.js";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "tll-core-")); });
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });

describe("task storage", () => {
  it("round trips Unicode PRD, stable steps and extension fields in both formats", () => {
    for (const format of ["quick", "standard"] as const) {
      const task = createTask(root, { title: "跨设备需求", actor: "张三", format, prd: "## Acceptance\n- 保留证据\n", plan: "- [ ] S42: 可追溯\n" });
      const updated = updateTask(root, task.meta.id, { expectedRevision: task.revision, metadata: { custom: { issue: 42 } } });
      expect(updated.prd).toBe(task.prd);
      expect(updated.plan).toBe(task.plan);
      expect(updated.meta.custom).toEqual({ issue: 42 });
    }
  });
  it("rejects stale writes and preserves manual edits", () => {
    const task = createTask(root, { title: "A", actor: "alice" });
    writeAtomic(root, `${task.directory}/task.md`, Object.values(task.files)[0] + "\nmanual\n");
    expect(() => updateTask(root, task.meta.id, { expectedRevision: task.revision, plan: "overwrite" })).toThrow("Task changed");
    expect(readTask(root, task.meta.id).plan).toContain("manual");
  });
  it("expands explicitly without losing attachments or trace identity", () => {
    const task = createTask(root, { id: "one", title: "A", actor: "alice" });
    writeAtomic(root, `${task.directory}/research/design.md`, "keep");
    const expanded = expandTask(root, "one", task.revision);
    expect(expanded.meta.id).toBe("one");
    expect(expanded.format).toBe("standard");
    expect(expanded.prd).toBe(task.prd);
    expect(readText(root, `${task.directory}/task.md`)).toBeNull();
    expect(readText(root, `${task.directory}/research/design.md`)).toBe("keep");
    expect(expandTask(root, "one", expanded.revision)).toEqual(expanded);
  });
  it("refuses expansion over pre-existing plan", () => {
    const task = createTask(root, { title: "A", actor: "alice" });
    writeAtomic(root, `${task.directory}/plan.md`, "custom");
    expect(() => expandTask(root, task.meta.id, task.revision)).toThrow("overwrite");
    expect(readText(root, `${task.directory}/plan.md`)).toBe("custom");
  });
  it.each(["../escape", "C:\\escape", "CON", "name.", "a/b"])("rejects unsafe task ID %s", (id) => {
    expect(() => createTask(root, { id, title: "A", actor: "alice" })).toThrow();
  });
  it("normalizes LF revisions", () => { expect(hash("a\r\nb")).toBe(hash("a\nb")); });
});

describe("trace and context", () => {
  function fixture(): { id: string; revision: string; session: ReturnType<typeof bindSession>; input: CheckpointInput } {
    const task = createTask(root, { title: "Trace", actor: "alice" });
    const session = bindSession(root, createSession(root, { human: "alice", platform: "codex" }).id, task.meta.id);
    return { id: task.meta.id, revision: task.revision, session, input: { schemaVersion: 1, key: "checkpoint-1", type: "checkpoint", summary: "Milestone", expectedRevision: task.revision } };
  }
  it("retries idempotently and rejects reuse for another payload", () => {
    const f = fixture();
    const first = checkpoint(root, f.id, f);
    expect(checkpoint(root, f.id, f)).toEqual(first);
    expect(readTrace(root, f.id)).toHaveLength(1);
    expect(() => checkpoint(root, f.id, { ...f, input: { ...f.input, summary: "different" } })).toThrow("different request");
  });
  it("finish is separate from verification and preserves its checkpoint on retry", () => {
    const f = fixture();
    f.input.type = "done";
    const event = checkpoint(root, f.id, f);
    expect(readTask(root, f.id).meta.status).toBe("done");
    expect(event.evidence).toBeUndefined();
    expect(checkpoint(root, f.id, f)).toEqual(event);
  });
  it("uses independent trace files and never guesses a task", () => {
    const f = fixture();
    checkpoint(root, f.id, f);
    const second = bindSession(root, createSession(root, { human: "bob", platform: "claude" }).id, f.id);
    checkpoint(root, f.id, { session: second, input: { ...f.input, key: "second" } });
    expect(readTrace(root, f.id).map((event) => event.seq)).toEqual([1, 1]);
    expect(context(root).task).toBeUndefined();
    expect(context(root).candidates).toHaveLength(1);
    expect(context(root, { session: f.session }).task?.id).toBe(f.id);
  });
  it("reports whole-document omissions instead of silently truncating acceptance", () => {
    const task = createTask(root, { title: "Large", actor: "alice", prd: "验收".repeat(10000) });
    const result = context(root, { id: task.meta.id, budget: 1024 });
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(1024);
    expect(result.sections[0].omitted).toContain("acceptance");
    expect(result.sections[0].content).toBeUndefined();
  });
});

describe("recovery", () => {
  it("recovers an interrupted expansion and refuses rollback after later edits", () => {
    const task = createTask(root, { title: "A", actor: "alice" });
    const original = fs.renameSync;
    vi.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (String(to).endsWith("plan.md")) throw new Error("simulated crash");
      original(from, to);
    });
    expect(() => expandTask(root, task.meta.id, task.revision)).toThrow("simulated crash");
    vi.restoreAllMocks();
    const directory = path.join(root, ".tll/.local/transactions");
    const pending = fs.readdirSync(directory).map((name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"))).find((tx) => tx.state === "pending");
    expect(pending).toBeDefined();
    recover(root, pending.id);
    expect(readTask(root, task.meta.id).format).toBe("standard");
    writeAtomic(root, `${task.directory}/plan.md`, "later edit");
    expect(() => recover(root, pending.id, true)).toThrow("Changed since planning");
    expect(readText(root, `${task.directory}/plan.md`)).toBe("later edit");
  });
});
