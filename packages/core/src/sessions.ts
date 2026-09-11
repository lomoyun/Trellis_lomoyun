import { randomUUID } from "node:crypto";
import { hash, json, readText, safeName, withLock, writeAtomic } from "./files.js";
import { LiteError, object, requiredText, type Actor, type Session } from "./model.js";
import { readTask } from "./tasks.js";

export function sessionPath(id: string): string {
  return `.tll/.local/sessions/${safeName(id)}.json`;
}

export function readSession(root: string, id: string): Session {
  const raw = readText(root, sessionPath(id));
  if (raw === null) throw new LiteError("SESSION_NOT_FOUND", "Create a local session on this device first");
  const value = object(JSON.parse(raw));
  const actor = object(value.actor);
  if (value.schemaVersion !== 1 || value.id !== id) throw new LiteError("INVALID_SESSION", "Invalid session record");
  requiredText(actor.human, "human");
  requiredText(actor.platform, "platform");
  if (value.task !== undefined) safeName(requiredText(value.task, "task"));
  return value as unknown as Session;
}

export function createSession(root: string, actor: Actor, nativeId?: string): Session {
  requiredText(actor.human, "human");
  requiredText(actor.platform, "platform");
  return withLock(root, "project", () => {
    const session: Session = { schemaVersion: 1, id: randomUUID(), actor };
    writeAtomic(root, sessionPath(session.id), json(session));
    if (nativeId) writeAtomic(root, nativePath(actor.platform, nativeId), json({ session: session.id }));
    return session;
  });
}

function nativePath(platform: string, nativeId: string): string {
  return `.tll/.local/native/${hash(`${platform}:${nativeId}`)}.json`;
}

export function nativeSession(root: string, platform: string, nativeId: string): Session | undefined {
  const raw = readText(root, nativePath(platform, nativeId));
  if (raw === null) return undefined;
  return readSession(root, requiredText(object(JSON.parse(raw)).session, "session"));
}

export function bindSession(root: string, sessionId: string, task: string): Session {
  return withLock(root, "project", () => {
    readTask(root, task);
    const session = readSession(root, sessionId);
    session.task = task;
    writeAtomic(root, sessionPath(session.id), json(session));
    return session;
  });
}
