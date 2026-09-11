import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { filePath, json, readText, relativeKey, safeName, withLock, writeAtomic } from "./files.js";
import { LiteError, object } from "./model.js";

export interface Change {
  path: string;
  before: string | null;
  after: string | null;
}
export interface Transaction {
  schemaVersion: 1;
  id: string;
  state: "pending" | "applied" | "rolled-back";
  changes: Change[];
}

export function changesFor(root: string, desired: Record<string, string | null>): Change[] {
  return Object.entries(desired).map(([key, after]) => ({ path: relativeKey(key), before: readText(root, key), after }))
    .filter((change) => change.before !== change.after);
}

function validateChanges(root: string, changes: Change[], retry: boolean): void {
  const seen = new Set<string>();
  for (const change of changes) {
    const key = relativeKey(change.path).toLowerCase();
    if (seen.has(key)) throw new LiteError("CONFLICT", `Duplicate transaction path: ${key}`);
    seen.add(key);
    const actual = readText(root, change.path);
    if (actual !== change.before && (!retry || actual !== change.after)) throw new LiteError("CONFLICT", `Changed since planning: ${change.path}`);
  }
}

function applyChanges(root: string, changes: Change[]): void {
  for (const change of changes) {
    const actual = readText(root, change.path);
    if (actual === change.after) continue;
    if (actual !== change.before) throw new LiteError("CONFLICT", `Changed during transaction: ${change.path}`);
    if (change.after === null) fs.unlinkSync(filePath(root, change.path));
    else writeAtomic(root, change.path, change.after);
  }
}

/** 调用方持有业务锁；完整 before/after 日志先落盘，恢复不覆盖后续编辑。 */
export function transact(root: string, changes: Change[]): Transaction {
  validateChanges(root, changes, false);
  const tx: Transaction = { schemaVersion: 1, id: randomUUID(), state: "pending", changes };
  const key = `.tll/.local/transactions/${tx.id}.json`;
  writeAtomic(root, key, json(tx));
  try {
    applyChanges(root, changes);
    tx.state = "applied";
    writeAtomic(root, key, json(tx));
  } catch (error) {
    throw new LiteError("TRANSACTION_PENDING", `Transaction ${tx.id} needs recovery: ${String(error)}`);
  }
  return tx;
}

function readTransaction(root: string, id: string): Transaction {
  const data = object(JSON.parse(readText(root, `.tll/.local/transactions/${safeName(id)}.json`) ?? "null"));
  if (data.schemaVersion !== 1 || data.id !== id || !Array.isArray(data.changes)) throw new LiteError("INVALID_DATA", "Invalid transaction");
  if (!["pending", "applied", "rolled-back"].includes(String(data.state))) throw new LiteError("INVALID_DATA", "Invalid transaction state");
  for (const value of data.changes) {
    const change = object(value);
    if (typeof change.path !== "string" || ![change.before, change.after].every((item) => item === null || typeof item === "string")) throw new LiteError("INVALID_DATA", "Invalid transaction change");
    if (relativeKey(change.path).startsWith(".trellis/")) throw new LiteError("MIGRATION_REQUIRED", "Historical .trellis transaction is read-only after directory migration; do not replay old paths");
  }
  return data as unknown as Transaction;
}

export function recover(root: string, id: string, rollback = false): Transaction {
  return withLock(root, "project", () => {
    const tx = readTransaction(root, id);
    if (tx.state === "rolled-back") return tx;
    const changes = rollback ? tx.changes.map((item) => ({ ...item, before: item.after, after: item.before })) : tx.changes;
    validateChanges(root, changes, true);
    applyChanges(root, changes);
    tx.state = rollback ? "rolled-back" : "applied";
    writeAtomic(root, `.tll/.local/transactions/${tx.id}.json`, json(tx));
    return tx;
  });
}
