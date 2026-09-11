import { hash, readText, relativeKey } from "./files.js";
import { LiteError, type Session, type TraceEvent } from "./model.js";
import { listTasks, readTask } from "./tasks.js";
import { readTrace } from "./trace.js";
import { contextBudget } from "./config.js";

export const CONTEXT_BUDGET = 16 * 1024;
const TASK_BRIEF_WARNING_BYTES = 8 * 1024;
const OMITTED_CONTENT = "Budget exceeded: read this complete file at the recorded revision when needed; acceptance criteria were not partially truncated";
const PRIORITY = { project: 0, task: 1, spec: 2, trace: 3 } as const;
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
    result.candidates = listed.tasks.filter((task) => task.meta.status !== "done" && task.meta.status !== "cancelled")
      .map((task) => ({ id: task.meta.id, title: task.meta.title, directory: task.directory }));
    result.warnings = listed.warnings;
  } else addTask(root, id, result);
  const project = readText(root, ".tll/project.md");
  if (project !== null) result.sections.push({ path: ".tll/project.md", revision: hash(project), content: project });
  for (const spec of options.specs ?? []) {
    const key = relativeKey(spec);
    if (!key.startsWith(".tll/spec/")) throw new LiteError("UNSAFE_PATH", "Explicit spec references must be inside .tll/spec");
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
  if (Buffer.byteLength(task.prd) + Buffer.byteLength(task.plan) > TASK_BRIEF_WARNING_BYTES) {
    result.warnings.push(`Task brief exceeds ${TASK_BRIEF_WARNING_BYTES} bytes: review independent deliverables; keep goal/scope/acceptance/steps concise and link details. No automatic split or truncation.`);
  }
  if (task.format === "legacy") { result.warnings.push("Legacy task is read-only; migrate before writing"); return; }
  const events = readTrace(root, id);
  // 每个会话取最新事件；时间戳只用于显示，不推断跨会话因果。
  const latest = new Map<string, (typeof events)[number]>();
  for (const event of events) latest.set(`${event.session}:${event.type === "handoff" ? "handoff" : "checkpoint"}`, event);
  for (const event of latest.values()) result.sections.push({ path: `${task.directory}/trace/${event.session}.jsonl#${event.seq}`, revision: event.revision, content: traceSummary(event) });
  if (latest.size) result.warnings.push("Trace summaries are reported outcomes only; read referenced events for full evidence and snapshots when needed.");
}

function traceSummary(event: TraceEvent): string {
  const { id, task, session, seq, at, type, actor, revision, summary } = event;
  return JSON.stringify({ id, task, session, seq, at, type, actor, revision, summary });
}

function sectionPriority(section: ContextSection): number {
  if (section.path === ".tll/project.md") return PRIORITY.project;
  if (/\.jsonl#\d+$/.test(section.path)) return PRIORITY.trace;
  if (section.path.startsWith(".tll/spec/")) return PRIORITY.spec;
  return PRIORITY.task;
}

function fitBudget(result: ContextResult, budget: number): ContextResult {
  if (Buffer.byteLength(JSON.stringify(result)) <= budget) return result;
  // 先预留全部引用，再逐项装入完整正文；超大项不能挤掉之后的小项。
  const pending = result.sections.map((section) => {
    const content = section.content;
    delete section.content;
    section.omitted = OMITTED_CONTENT;
    return { section, content };
  }).sort((a, b) => sectionPriority(a.section) - sectionPriority(b.section));
  let used = Buffer.byteLength(JSON.stringify(result));
  for (const { section, content } of pending) {
    section.content = content;
    delete section.omitted;
    const candidate = Buffer.byteLength(JSON.stringify(result));
    if (candidate <= budget || candidate <= used) { used = candidate; continue; }
    delete section.content;
    section.omitted = OMITTED_CONTENT;
  }
  if (used > budget) throw new LiteError("CONTEXT_BUDGET", "References exceed budget; select a task or increase --budget");
  return result;
}
