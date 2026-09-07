export const SCHEMA = 1 as const;
export const STATUSES = ["draft", "doing", "blocked", "done", "cancelled"] as const;
export type Status = (typeof STATUSES)[number];
export type JsonObject = Record<string, unknown>;

export interface TaskMeta extends JsonObject {
  schemaVersion: 1;
  id: string;
  title: string;
  creator: string;
  owner: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  format: "quick" | "standard" | "legacy";
  meta: TaskMeta;
  prd: string;
  plan: string;
  revision: string;
  files: Record<string, string>;
  directory: string;
}

export interface Actor {
  human: string;
  platform: string;
  agent?: string;
}

export interface Session {
  schemaVersion: 1;
  id: string;
  actor: Actor;
  task?: string;
}

export const EVENT_TYPES = ["checkpoint", "decision", "milestone", "block", "verify", "handoff", "done", "native-goal"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export interface CheckpointInput {
  schemaVersion: 1;
  key: string;
  type: EventType;
  summary: string;
  expectedRevision: string;
  evidence?: JsonObject;
}

export interface TraceEvent extends CheckpointInput {
  id: string;
  task: string;
  session: string;
  seq: number;
  at: string;
  actor: Actor;
  revision: string;
  snapshots: Record<string, string>;
  requestHash: string;
  collected?: JsonObject;
}

export class LiteError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "LiteError";
  }
}

export function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LiteError("INVALID_DATA", "Expected an object");
  }
  return value as JsonObject;
}

export function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new LiteError("INVALID_DATA", `${label} must be a nonempty string`);
  }
  return value;
}

export function status(value: unknown): Status {
  if (!STATUSES.some((item) => item === value)) throw new LiteError("INVALID_STATUS", String(value));
  return value as Status;
}

export function metadata(value: unknown): TaskMeta {
  const data = object(value);
  if (data.schemaVersion !== SCHEMA) throw new LiteError("UNSUPPORTED_SCHEMA", "Task schema must be 1");
  for (const field of ["id", "title", "creator", "owner", "createdAt", "updatedAt"]) requiredText(data[field], field);
  status(data.status);
  return data as TaskMeta;
}

export function checkpointInput(value: unknown): CheckpointInput {
  const data = object(value);
  if (data.schemaVersion !== SCHEMA) throw new LiteError("UNSUPPORTED_SCHEMA", "Input schema must be 1");
  for (const field of ["key", "summary", "expectedRevision"]) requiredText(data[field], field);
  if (!EVENT_TYPES.some((item) => item === data.type)) throw new LiteError("INVALID_EVENT", "Unknown event type");
  if (data.evidence !== undefined) object(data.evidence);
  return data as unknown as CheckpointInput;
}
