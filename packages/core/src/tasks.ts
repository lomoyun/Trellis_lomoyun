import { randomUUID } from "node:crypto";
import { parse, stringify } from "yaml";
import { assertNamespace, canonicalJson, entries, hash, json, normalize, readText, relativeKey, safeName, withLock } from "./files.js";
import { LiteError, metadata, object, requiredText, type Task, type TaskMeta, type JsonObject } from "./model.js";
import { changesFor, transact } from "./transactions.js";

export const TASK_ROOT = ".tll/tasks";
const PLAN_MARKER = "\n<!-- tll:plan -->\n";

export function taskDirectory(id: string): string {
  return `${TASK_ROOT}/${safeName(id)}`;
}

export function taskFiles(task: Pick<Task, "format" | "meta" | "prd" | "plan" | "directory">): Record<string, string> {
  const dir = task.directory;
  if (task.format === "quick") return { [`${dir}/task.md`]: `---\n${stringify(task.meta)}---\n${task.prd}${PLAN_MARKER}${task.plan}` };
  return { [`${dir}/task.json`]: json(task.meta), [`${dir}/prd.md`]: task.prd, [`${dir}/plan.md`]: task.plan };
}

export function revision(files: Record<string, string>): string {
  return hash(canonicalJson(Object.fromEntries(Object.entries(files).map(([key, text]) => [key, normalize(text)]))));
}

function quickTask(text: string): { meta: TaskMeta; prd: string; plan: string } {
  const normalized = normalize(text);
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(normalized);
  if (!match) throw new LiteError("INVALID_TASK", "Quick task needs YAML frontmatter");
  const boundary = match[2].indexOf(PLAN_MARKER);
  if (boundary < 0) throw new LiteError("INVALID_TASK", "Keep the <!-- tll:plan --> separator");
  return { meta: metadata(parse(match[1])), prd: match[2].slice(0, boundary), plan: match[2].slice(boundary + PLAN_MARKER.length) };
}

export function readTask(root: string, id: string): Task {
  assertNamespace(root);
  return readTaskDirectory(root, taskDirectory(id));
}

export function readTaskDirectory(root: string, directory: string): Task {
  const dir = relativeKey(directory);
  if (!dir.startsWith(`${TASK_ROOT}/`)) throw new LiteError("UNSAFE_PATH", "Not a task directory");
  const quick = readText(root, `${dir}/task.md`);
  const standard = readText(root, `${dir}/task.json`);
  if (quick !== null && standard !== null) throw new LiteError("CONFLICT", `Both task formats exist: ${dir}`);
  if (quick !== null) {
    const files = { [`${dir}/task.md`]: quick };
    const data = quickTask(quick);
    assertStoredId(data.meta, dir);
    return { ...data, format: "quick", files, revision: revision(files), directory: dir };
  }
  if (standard === null) throw new LiteError("NOT_FOUND", `Task not found: ${dir}`);
  const raw = object(JSON.parse(standard));
  const legacy = raw.schemaVersion === undefined;
  const meta = legacy ? legacyMetadata(raw, dir) : metadata(raw);
  assertStoredId(meta, dir);
  const prd = readText(root, `${dir}/prd.md`) ?? "";
  const plan = readText(root, `${dir}/plan.md`) ?? readText(root, `${dir}/implement.md`) ?? "";
  const files: Record<string, string> = { [`${dir}/task.json`]: standard, [`${dir}/prd.md`]: prd };
  const planFile = readText(root, `${dir}/plan.md`) === null && legacy ? "implement.md" : "plan.md";
  files[`${dir}/${planFile}`] = plan;
  return { format: legacy ? "legacy" : "standard", meta, prd, plan, files, revision: revision(files), directory: dir };
}

function assertStoredId(meta: TaskMeta, directory: string): void {
  if (safeName(meta.id) !== directory.split("/").at(-1)) throw new LiteError("INVALID_TASK", "Task identity does not match its stable directory");
}

export function legacyMetadata(raw: JsonObject, dir: string): TaskMeta {
  const statuses: Record<string, TaskMeta["status"]> = { planning: "draft", in_progress: "doing", "in-progress": "doing", review: "doing", completed: "done", archived: "done", blocked: "blocked", cancelled: "cancelled" };
  const id = dir.split("/").at(-1) ?? "legacy";
  const actor = typeof raw.creator === "string" && raw.creator ? raw.creator : "legacy-unknown";
  return { ...raw, schemaVersion: 1, id, title: String(raw.title ?? raw.name ?? id), creator: actor, owner: String(raw.owner ?? raw.assignee ?? actor), status: statuses[String(raw.status)] ?? "draft", createdAt: String(raw.createdAt ?? raw.created_at ?? "unknown"), updatedAt: String(raw.updatedAt ?? raw.updated_at ?? "unknown"), legacy: raw };
}

export function listTasks(root: string, archive = false): { tasks: Task[]; warnings: string[] } {
  assertNamespace(root);
  const result: { tasks: Task[]; warnings: string[] } = { tasks: [], warnings: [] };
  function visit(dir: string): void {
    for (const entry of entries(root, dir)) {
      if (!entry.isDirectory() || (!archive && entry.name === "archive")) continue;
      const child = `${dir}/${entry.name}`;
      if (readText(root, `${child}/task.json`) === null && readText(root, `${child}/task.md`) === null) { if (archive) visit(child); continue; }
      try { result.tasks.push(readTaskDirectory(root, child)); }
      catch (error) { result.warnings.push(`${child}: ${String(error)}`); }
    }
  }
  visit(TASK_ROOT);
  return result;
}

export interface NewTask {
  title: string;
  actor: string;
  id?: string;
  format?: "quick" | "standard";
  prd?: string;
  plan?: string;
}

export function createTask(root: string, input: NewTask): Task {
  return withLock(root, "project", () => {
    const id = safeName(input.id ?? randomUUID());
    const directory = taskDirectory(id);
    if (listTasks(root, true).tasks.some((task) => task.meta.id.toLowerCase() === id.toLowerCase())) throw new LiteError("CONFLICT", `Task ID already exists: ${id}`);
    if (entries(root, directory).length) throw new LiteError("CONFLICT", `Directory is not empty: ${directory}`);
    const now = new Date().toISOString();
    const meta: TaskMeta = { schemaVersion: 1, id, title: requiredText(input.title, "title"), creator: requiredText(input.actor, "actor"), owner: input.actor, status: "draft", createdAt: now, updatedAt: now };
    const data = { directory, meta, format: input.format ?? "quick", prd: input.prd ?? `# ${input.title}\n\n## Goal\n\n<!-- One independently deliverable outcome, not a project-wide backlog. -->\n\n## Scope\n\n<!-- In scope: what this delivery includes. Out of scope: separate deliverables. -->\n\n## Acceptance\n\n<!-- Observable criteria for completing this outcome. -->\n\n## References\n\n<!-- Link related Task IDs, designs and evidence; do not copy their history. -->\n\n`, plan: input.plan ?? "# Plan\n\n- [ ] S1: Describe the next step\n" };
    transact(root, changesFor(root, taskFiles(data)));
    return readTask(root, id);
  });
}

export function assertRevision(task: Task, expected: string): void {
  if (task.revision !== expected) throw new LiteError("REVISION_CONFLICT", "Task changed; read again before writing");
  if (task.format === "legacy") throw new LiteError("MIGRATION_REQUIRED", "Legacy tasks are read-only; run migrate first");
}

export interface TaskUpdate {
  expectedRevision: string;
  metadata?: JsonObject;
  prd?: string;
  plan?: string;
}

export function updateTask(root: string, id: string, input: TaskUpdate): Task {
  return withLock(root, "project", () => {
    const task = readTask(root, id);
    assertRevision(task, input.expectedRevision);
    const patch = input.metadata ?? {};
    for (const field of ["id", "schemaVersion", "creator", "createdAt"]) {
      if (field in patch && patch[field] !== task.meta[field]) throw new LiteError("IMMUTABLE_FIELD", field);
    }
    task.meta = metadata({ ...task.meta, ...patch, updatedAt: new Date().toISOString() });
    task.prd = input.prd ?? task.prd;
    task.plan = input.plan ?? task.plan;
    transact(root, changesFor(root, taskFiles(task)));
    return readTask(root, id);
  });
}

export function expandTask(root: string, id: string, expected: string): Task {
  return withLock(root, "project", () => {
    const task = readTask(root, id);
    assertRevision(task, expected);
    if (task.format === "standard") return task;
    for (const name of ["task.json", "prd.md", "plan.md"]) {
      if (readText(root, `${task.directory}/${name}`) !== null) throw new LiteError("CONFLICT", `Expansion would overwrite ${name}`);
    }
    task.format = "standard";
    transact(root, changesFor(root, { ...taskFiles(task), [`${task.directory}/task.md`]: null }));
    return readTask(root, id);
  });
}
