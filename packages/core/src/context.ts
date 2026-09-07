import { hash, readText, relativeKey } from "./files.js";
import { LiteError, type Session } from "./model.js";
import { listTasks, readTask } from "./tasks.js";
import { readTrace } from "./trace.js";
import { contextBudget } from "./config.js";

export const CONTEXT_BUDGET = 16 * 1024;
interface ContextSection { path: string; revision: string; content?: string; omitted?: string }
export interface ContextResult {
  schemaVersion: 1;
  task?: { id: string; title: string; status: string; revision: string };
  candidates?: { id: string; title: string; directory: string }[];
  sections: ContextSection[];
  warnings: string[];
}

export function context(root: string, options: { id?: string; session?: Session; budget?: number; specs?: string[] } = {}): ContextResult {
  const budget = options.budget ?? contextBudget(root, CONTEXT_BUDGET);
  if (!Number.isSafeInteger(budget) || budget < 1024) throw new LiteError("INVALID_BUDGET", "Context budget must be at least 1024 bytes");
  const result: ContextResult = { schemaVersion: 1, sections: [], warnings: [] };
  const id = options.id ?? options.session?.task;
  if (!id) {
    const listed = listTasks(root);
    result.candidates = listed.tasks.map((task) => ({ id: task.meta.id, title: task.meta.title, directory: task.directory }));
    result.warnings = listed.warnings;
  } else addTask(root, id, result);
  const project = readText(root, ".trellis/project.md");
  if (project !== null) result.sections.push({ path: ".trellis/project.md", revision: hash(project), content: project });
  for (const spec of options.specs ?? []) {
    const key = relativeKey(spec);
    if (!key.startsWith(".trellis/spec/")) throw new LiteError("UNSAFE_PATH", "Explicit spec references must be inside .trellis/spec");
    const content = readText(root, key);
    if (content === null) result.warnings.push(`Spec missing: ${key}`);
    else result.sections.push({ path: key, revision: hash(content), content });
  }
  return fitBudget(result, budget);
}

function addTask(root: string, id: string, result: ContextResult): void {
  const task = readTask(root, id);
  result.task = { id, title: task.meta.title, status: task.meta.status, revision: task.revision };
  result.sections.push(...Object.entries(task.files).map(([path, content]) => ({ path, revision: hash(content), content })));
  if (task.format === "legacy") { result.warnings.push("Legacy task is read-only; migrate before writing"); return; }
  const events = readTrace(root, id);
  // 每个会话取最新事件；时间戳只用于显示，不推断跨会话因果。
  const latest = new Map<string, (typeof events)[number]>();
  for (const event of events) latest.set(`${event.session}:${event.type === "handoff" ? "handoff" : "checkpoint"}`, event);
  for (const event of latest.values()) result.sections.push({ path: `${task.directory}/trace/${event.session}.jsonl#${event.seq}`, revision: event.revision, content: JSON.stringify({ ...event, snapshots: undefined }) });
}

function fitBudget(result: ContextResult, budget: number): ContextResult {
  for (let index = result.sections.length - 1; Buffer.byteLength(JSON.stringify(result)) > budget && index >= 0; index--) {
    const section = result.sections[index];
    delete section.content;
    section.omitted = "Budget exceeded: read this complete file at the recorded revision; acceptance criteria were not partially truncated";
  }
  if (Buffer.byteLength(JSON.stringify(result)) > budget) throw new LiteError("CONTEXT_BUDGET", "References exceed budget; select a task or increase --budget");
  return result;
}
