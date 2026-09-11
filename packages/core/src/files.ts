import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { LiteError } from "./model.js";

export function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

export function hash(text: string): string {
  return createHash("sha256").update(normalize(text)).digest("hex");
}

export function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function canonicalJson(value: unknown): string {
  function sorted(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(sorted);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, content]) => [key, sorted(content)]));
    return item;
  }
  return JSON.stringify(sorted(value));
}

export function safeName(value: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(value) || /[. ]$/.test(value) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)) {
    throw new LiteError("UNSAFE_PATH", `Invalid portable name: ${value}`);
  }
  return value;
}

export function relativeKey(value: string): string {
  const key = value.replace(/\\/g, "/");
  if (key.startsWith("/") || key.split("/").some((part) => !part || part === "." || part === ".." || part.includes(":")) || [...key].some((char) => char.charCodeAt(0) < 32)) {
    throw new LiteError("UNSAFE_PATH", `Expected a relative path: ${value}`);
  }
  if (key.split("/").some((part) => part.toLowerCase() === ".git")) throw new LiteError("UNSAFE_PATH", "Git internals are not project records");
  return key;
}

/** 拒绝所有链接组件；共享文件不依赖本机链接目标。 */
export function filePath(root: string, key: string): string {
  const base = fs.realpathSync(root);
  let target = base;
  for (const part of relativeKey(key).split("/")) {
    target = path.join(target, part);
    try {
      if (fs.lstatSync(target).isSymbolicLink()) throw new LiteError("UNSAFE_PATH", `Symlink refused: ${key}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return target;
}

export function readText(root: string, key: string): string | null {
  try {
    return fs.readFileSync(filePath(root, key), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function writeAtomic(root: string, key: string, content: string): void {
  const target = filePath(root, key);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.${randomUUID()}.tmp`;
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(temp, "wx", 0o600);
    fs.writeFileSync(descriptor, content, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temp, target);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(temp, { force: true });
  }
}

export function entries(root: string, key: string): fs.Dirent[] {
  const target = filePath(root, key);
  return fs.existsSync(target) ? fs.readdirSync(target, { withFileTypes: true }) : [];
}

export function withLock<T>(root: string, name: string, action: () => T): T {
  assertNamespace(root);
  const ignoreKey = ".tll/.gitignore";
  const ignored = readText(root, ignoreKey) ?? "";
  if (!ignored.split(/\r?\n/).includes("/.local/")) writeAtomic(root, ignoreKey, `${ignored.trimEnd()}\n/.local/\n`.trimStart());
  const key = `.tll/.local/locks/${safeName(name)}.lock`;
  const target = filePath(root, key);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  let descriptor: number;
  try {
    descriptor = fs.openSync(target, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new LiteError("LOCKED", `${key}: another writer or interrupted process; inspect before removing the lock`);
    throw error;
  }
  try {
    fs.writeFileSync(descriptor, json({ pid: process.pid, at: new Date().toISOString() }));
    return action();
  } finally {
    fs.closeSync(descriptor);
    fs.unlinkSync(target);
  }
}

export function assertNamespace(root: string): void {
  if (fs.existsSync(filePath(root, ".trellis"))) throw new LiteError("MIGRATION_REQUIRED", "Old .trellis directory exists; stop old agents and run tll migrate --rename-directory --dry-run, then --apply");
}
