import { entries, hash, json, LiteError, object, readSession, readText, requiredText, safeName, withLock, writeAtomic, type JsonObject, type Session } from "@trellis-lite/core";
import { gitIdentity } from "./git.js";

export interface Policy {
  schemaVersion: 1;
  identity: string;
  scope: "records" | "task";
  duration: "session" | "task" | "repo-user";
  session?: string;
  task?: string;
  grantedAt: string;
}

function policyPath(root: string): string {
  return `.trellis/.local/policies/${hash(gitIdentity(root))}.json`;
}

export function readPolicy(root: string): Policy | null {
  if (!entries(root, ".trellis/.local/policies").length) return null;
  const text = readText(root, policyPath(root));
  if (text === null) return null;
  const data = object(JSON.parse(text));
  if (data.revoked === true) return null;
  if (data.schemaVersion !== 1 || data.identity !== gitIdentity(root)) throw new LiteError("INVALID_POLICY", "Invalid policy identity/version");
  if (!["records", "task"].includes(String(data.scope)) || !["session", "task", "repo-user"].includes(String(data.duration))) throw new LiteError("INVALID_POLICY", "Invalid authorization scope");
  return data as unknown as Policy;
}

export function grantPolicy(root: string, input: JsonObject): Policy {
  if (input.ack !== "allow-local-commits") throw new LiteError("CONSENT_REQUIRED", "Human authorization requires --ack allow-local-commits");
  if (!["records", "task"].includes(String(input.scope)) || !["session", "task", "repo-user"].includes(String(input.duration))) throw new LiteError("INVALID_POLICY", "Specify scope and duration");
  const policy: Policy = { schemaVersion: 1, identity: gitIdentity(root), scope: input.scope as Policy["scope"], duration: input.duration as Policy["duration"], grantedAt: new Date().toISOString() };
  if (policy.duration === "session") policy.session = readSession(root, requiredText(input.session, "session")).id;
  if (policy.duration === "task") policy.task = safeName(requiredText(input.task, "task"));
  return withLock(root, "project", () => { writeAtomic(root, policyPath(root), json(policy)); return policy; });
}

export function revokePolicy(root: string): void {
  withLock(root, "project", () => writeAtomic(root, policyPath(root), json({ schemaVersion: 1, revoked: true })));
}

export function policyApplies(policy: Policy, session: Session, task: string): boolean {
  if (policy.duration === "session") return policy.session === session.id;
  if (policy.duration === "task") return policy.task === task;
  return true;
}
