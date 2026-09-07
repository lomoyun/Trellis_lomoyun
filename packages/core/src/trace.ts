import { randomUUID } from "node:crypto";
import { canonicalJson, entries, hash, json, readText, safeName, withLock } from "./files.js";
import { checkpointInput, LiteError, object, requiredText, type CheckpointInput, type JsonObject, type Session, type TraceEvent } from "./model.js";
import { assertRevision, readTask, revision, taskDirectory, taskFiles } from "./tasks.js";
import { changesFor, transact } from "./transactions.js";

function decodeEvent(value: unknown): TraceEvent {
  checkpointInput(value);
  const data = object(value);
  for (const field of ["id", "task", "session", "at", "revision", "requestHash"]) requiredText(data[field], field);
  if (!Number.isSafeInteger(data.seq) || Number(data.seq) < 1) throw new LiteError("INVALID_TRACE", "Invalid sequence");
  const actor = object(data.actor);
  requiredText(actor.human, "actor.human");
  requiredText(actor.platform, "actor.platform");
  if (!Object.values(object(data.snapshots)).every((text) => typeof text === "string")) throw new LiteError("INVALID_TRACE", "Invalid snapshots");
  return data as unknown as TraceEvent;
}

export function readTrace(root: string, id: string): TraceEvent[] {
  const dir = `${taskDirectory(id)}/trace`;
  const result: TraceEvent[] = [];
  for (const entry of entries(root, dir).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
    const lines = (readText(root, `${dir}/${entry.name}`) ?? "").split(/\r?\n/).filter(Boolean);
    const events = lines.map((line) => decodeEvent(JSON.parse(line)));
    events.forEach((event, index) => {
      if (event.seq !== index + 1 || `${event.session}.jsonl` !== entry.name || event.task !== id) throw new LiteError("INVALID_TRACE", `Broken trace sequence: ${entry.name}`);
    });
    result.push(...events);
  }
  return result;
}

export function checkpoint(root: string, id: string, options: { session: Session; input: CheckpointInput; collected?: JsonObject }): TraceEvent {
  return withLock(root, "project", () => {
    const input = checkpointInput(options.input);
    const session = options.session;
    safeName(session.id);
    if (session.task !== id) throw new LiteError("SESSION_MISMATCH", "Bind this session to the task first");
    const events = readTrace(root, id);
    const requestHash = hash(canonicalJson({ input, actor: session.actor }));
    const previous = events.find((event) => event.key === input.key);
    if (previous) {
      if (previous.requestHash !== requestHash) throw new LiteError("IDEMPOTENCY_CONFLICT", "This key was used for a different request");
      return previous;
    }
    const task = readTask(root, id);
    assertRevision(task, input.expectedRevision);
    if (input.type === "done") { task.meta.status = "done"; task.meta.updatedAt = new Date().toISOString(); }
    const snapshots = input.type === "done" ? taskFiles(task) : task.files;
    const own = events.filter((event) => event.session === session.id);
    const event: TraceEvent = { ...input, id: randomUUID(), task: id, session: session.id, seq: own.length + 1, at: new Date().toISOString(), actor: session.actor, revision: revision(snapshots), snapshots, requestHash, collected: options.collected };
    const traceKey = `${task.directory}/trace/${session.id}.jsonl`;
    const desired: Record<string, string> = { ...snapshots, [traceKey]: [...own, event].map((item) => JSON.stringify(item)).join("\n") + "\n" };
    if (input.type === "handoff") desired[handoffPath(event)] = handoffText(event);
    transact(root, changesFor(root, desired));
    return event;
  });
}

export function handoffPath(event: TraceEvent): string {
  return `.trellis/workspace/${hash(event.actor.human).slice(0, 16)}/${event.session}/${event.id}.md`;
}

export function handoffText(event: TraceEvent): string {
  return `# Handoff: ${event.task}\n\n${event.summary}\n\nActor: ${event.actor.human}\nPlatform: ${event.actor.platform}\nTask revision: ${event.revision}\nTrace: ${taskDirectory(event.task)}/trace/${event.session}.jsonl#${event.seq}\n\n## Evidence (reported, not independently verified)\n\n\`\`\`json\n${json(event.evidence ?? {})}\`\`\`\n`;
}
