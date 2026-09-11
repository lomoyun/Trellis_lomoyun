import fs from "node:fs";
import { entries, filePath, json, readText } from "./files.js";
import { LiteError, object } from "./model.js";

/** 独立的目录切换步骤：不改写附件、历史快照或旧本地状态。 */
export function directoryMigration(root: string, apply = false): { schemaVersion: 1; source: string; destination: string; applied: boolean; next: string[] } {
  checkDirectoryMigration(root);
  const result = { schemaVersion: 1 as const, source: ".trellis", destination: ".tll", applied: false, next: ["tll migrate --dry-run", "tll migrate --apply", "tll init"] };
  if (!apply) return result;
  const lock = filePath(root, ".tll-migrate.lock");
  let descriptor: number;
  try { descriptor = fs.openSync(lock, "wx", 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new LiteError("LOCKED", "Inspect .tll-migrate.lock before retrying directory migration");
    throw error;
  }
  try {
    fs.writeFileSync(descriptor, json({ pid: process.pid }));
    checkDirectoryMigration(root);
    fs.renameSync(filePath(root, ".trellis"), filePath(root, ".tll"));
    return { ...result, applied: true };
  } finally {
    fs.closeSync(descriptor);
    fs.unlinkSync(lock);
  }
}

function checkDirectoryMigration(root: string): void {
  const source = filePath(root, ".trellis");
  const destination = filePath(root, ".tll");
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) throw new LiteError("NOT_FOUND", "No .trellis directory to migrate");
  if (fs.existsSync(destination)) throw new LiteError("CONFLICT", "Both .trellis and .tll exist; merge manually, never overwrite either directory");
  if (entries(root, ".trellis/.local/locks").length) throw new LiteError("LOCKED", "Old write locks exist; stop old agents and inspect locks before migration");
  for (const entry of entries(root, ".trellis/.local/transactions")) {
    const data = object(JSON.parse(readText(root, `.trellis/.local/transactions/${entry.name}`) ?? "null"));
    if (!["applied", "rolled-back"].includes(String(data.state))) throw new LiteError("TRANSACTION_PENDING", "Recover old transactions with the old CLI before directory migration");
  }
  checkTree(root, ".trellis");
}

function checkTree(root: string, key: string): void {
  for (const entry of entries(root, key)) {
    const child = `${key}/${entry.name}`;
    filePath(root, child);
    if (entry.isDirectory()) checkTree(root, child);
    else if (!entry.isFile()) throw new LiteError("UNSAFE_PATH", `Unsupported migration entry: ${child}`);
  }
}
