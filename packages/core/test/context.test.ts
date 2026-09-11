import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { bindSession, checkpoint, context, createSession, createTask, hash, readTask, readText, readTrace, updateTask, writeAtomic } from "../src/index.js";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "tll-context-")); });
afterEach(async () => { await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 10 }); });

it("offers active tasks only but permits explicit historical reads", () => {
  for (const status of ["draft", "doing", "blocked", "done", "cancelled"] as const) {
    const task = createTask(root, { id: status, title: status, actor: "alice" });
    updateTask(root, status, { expectedRevision: task.revision, metadata: { status } });
  }
  expect(context(root).candidates?.map((task) => task.id).sort()).toEqual(["blocked", "doing", "draft"]);
  expect(context(root, { id: "done" }).task?.status).toBe("done");
  expect(context(root, { id: "cancelled" }).task?.status).toBe("cancelled");
});

it.each(["quick", "standard"] as const)("keeps small context around oversized %s task documents", (format) => {
  const prd = "## Acceptance\n" + "完整验收条件".repeat(2000);
  const task = createTask(root, { id: "large", title: "Large", actor: "alice", format, prd, plan: "- [ ] S1: Verify\n" });
  writeAtomic(root, ".tll/project.md", "# Project\nRun the tests.\n");
  writeAtomic(root, ".tll/spec/testing.md", "# Tests\nKeep evidence.\n");
  const session = bindSession(root, createSession(root, { human: "alice", platform: "codex" }).id, "large");
  checkpoint(root, "large", { session, input: { schemaVersion: 1, key: "start", type: "checkpoint", summary: "Started", expectedRevision: task.revision } });
  const result = context(root, { id: "large", budget: 4096, specs: [".tll/spec/testing.md"] });
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(4096);
  expect(result.sections.find((part) => part.path === ".tll/project.md")?.content).toContain("Run the tests");
  expect(result.sections.find((part) => part.path.endsWith("testing.md"))?.content).toContain("Keep evidence");
  expect(result.sections.find((part) => part.path.includes(".jsonl#"))?.content).toContain("Started");
  const largePath = `${task.directory}/${format === "quick" ? "task.md" : "prd.md"}`;
  expect(result.sections.find((part) => part.path === largePath)).toMatchObject({ revision: hash(task.files[largePath]), omitted: expect.stringContaining("acceptance") });
  expect(result.warnings.join(" ")).toContain("independent deliverables");
  if (format === "standard") expect(result.sections.find((part) => part.path.endsWith("plan.md"))?.content).toContain("S1");
  expect(readTask(root, "large").prd).toBe(prd);
});

it("projects trace summaries without injecting evidence, snapshots or collection payloads", () => {
  const task = createTask(root, { id: "trace", title: "Trace", actor: "alice" });
  const session = bindSession(root, createSession(root, { human: "alice", platform: "codex" }).id, "trace");
  const event = checkpoint(root, "trace", {
    session, input: { schemaVersion: 1, key: "verify", type: "verify", summary: "Reported test result", expectedRevision: task.revision, evidence: { log: "evidence-only".repeat(3000) } },
    collected: { log: "collection-only".repeat(3000) },
  });
  const result = context(root, { id: "trace" });
  const section = result.sections.find((part) => part.path.includes(".jsonl#"));
  expect(section?.content).toBeDefined();
  const summary = JSON.parse(section?.content ?? "{}");
  expect(summary).toMatchObject({ type: "verify", summary: event.summary, actor: event.actor, seq: 1 });
  expect(summary.evidence).toBeUndefined();
  expect(summary.collected).toBeUndefined();
  expect(summary.snapshots).toBeUndefined();
  expect(result.warnings.join(" ")).toContain("full evidence");
  expect(readTrace(root, "trace")[0]).toEqual(event);
});

it("does not load attachments or another task's documents", () => {
  createTask(root, { id: "selected", title: "Selected", actor: "alice" });
  createTask(root, { id: "other", title: "Other", actor: "alice", prd: "OTHER_TASK_BODY" });
  writeAtomic(root, ".tll/tasks/selected/research/details.md", "ATTACHMENT_BODY");
  const result = JSON.stringify(context(root, { id: "selected" }));
  expect(result).not.toContain("OTHER_TASK_BODY");
  expect(result).not.toContain("ATTACHMENT_BODY");
  expect(readText(root, ".tll/tasks/selected/research/details.md")).toBe("ATTACHMENT_BODY");
});

it("creates a brief scaffold for one deliverable without changing supplied documents", () => {
  const brief = createTask(root, { title: "Brief", actor: "alice" });
  expect(brief.prd).toContain("One independently deliverable outcome");
  expect(brief.prd).toContain("Out of scope");
  expect(brief.prd).toContain("## References");
  const supplied = createTask(root, { title: "Supplied", actor: "alice", prd: "Keep exact PRD", plan: "- [ ] S99: Keep exact plan" });
  expect(supplied.prd).toBe("Keep exact PRD");
  expect(supplied.plan).toBe("- [ ] S99: Keep exact plan");
});

it("prioritizes complete project and task documents over a large historical summary", () => {
  const task = createTask(root, { id: "priority", title: "Priority", actor: "alice", prd: "## Acceptance\n" + "a".repeat(700) });
  const project = "# Project\n" + "p".repeat(300);
  writeAtomic(root, ".tll/project.md", project);
  const session = bindSession(root, createSession(root, { human: "alice", platform: "codex" }).id, "priority");
  checkpoint(root, "priority", { session, input: { schemaVersion: 1, key: "large-summary", type: "checkpoint", summary: "s".repeat(2500), expectedRevision: task.revision } });
  const result = context(root, { id: "priority", budget: 4096 });
  expect(result.sections.find((part) => part.path.endsWith("task.md"))?.content).toBe(task.files[`${task.directory}/task.md`]);
  expect(result.sections.find((part) => part.path === ".tll/project.md")?.content).toBe(project);
  expect(result.sections.find((part) => part.path.includes(".jsonl#"))?.omitted).toContain("Budget");
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(4096);
});

it("retains the latest checkpoint and handoff per session without copying full history", () => {
  const task = createTask(root, { id: "sessions", title: "Sessions", actor: "alice" });
  for (const human of ["alice", "bob"]) {
    const session = bindSession(root, createSession(root, { human, platform: "codex" }).id, "sessions");
    for (const [key, type] of [["old", "checkpoint"], ["handoff", "handoff"], ["latest", "verify"]] as const) {
      checkpoint(root, "sessions", { session, input: { schemaVersion: 1, key: `${human}-${key}`, type, summary: `${human}-${key}`, expectedRevision: task.revision } });
    }
  }
  const summaries = context(root, { id: "sessions" }).sections.filter((part) => part.path.includes(".jsonl#")).map((part) => JSON.parse(part.content ?? "{}"));
  expect(summaries.map((item) => item.summary).sort()).toEqual(["alice-handoff", "alice-latest", "bob-handoff", "bob-latest"]);
  expect(readTrace(root, "sessions")).toHaveLength(6);
});

it("uses UTF-8 bytes for advisory size checks, without a hard task size limit", () => {
  const prd = "字".repeat(2800);
  const task = createTask(root, { id: "utf8", title: "Unicode", actor: "alice", prd, plan: "" });
  const result = context(root, { id: "utf8", budget: 16384 });
  expect(result.warnings.join(" ")).toContain("8192 bytes");
  expect(result.sections[0].content).toBe(task.files[`${task.directory}/task.md`]);
  expect(result.sections[0].omitted).toBeUndefined();
});

it("counts JSON escaping and restores tiny content even when omission text is larger", () => {
  const project = '"\\\n'.repeat(600);
  writeAtomic(root, ".tll/project.md", project);
  const result = context(root, { budget: 2048 });
  expect(result.sections[0].content).toBeUndefined();
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(2048);
  writeAtomic(root, ".tll/project.md", "");
  createTask(root, { title: "Large", actor: "alice", prd: "x".repeat(20000) });
  const small = context(root, { id: context(root).candidates?.[0].id, budget: 1024 });
  expect(small.sections.find((part) => part.path === ".tll/project.md")?.content).toBe("");
  expect(Buffer.byteLength(JSON.stringify(small))).toBeLessThanOrEqual(1024);
});

it("reports an error when references alone cannot fit the requested budget", () => {
  for (let index = 0; index < 12; index++) createTask(root, { id: `task-${index}`, title: "Candidate ".repeat(15), actor: "alice" });
  expect(() => context(root, { budget: 1024 })).toThrow("References exceed budget");
});
