import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { changesFor, localUserFiles, readLocalUser, readText, recover, transact, withLock, writeAtomic } from "../src/index.js";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "tll-user-storage-")); });
afterEach(async () => { await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 10 }); });

it("reads missing identity without creating local state", () => {
  expect(readLocalUser(root)).toBeUndefined();
  expect(fs.readdirSync(root)).toEqual([]);
});

it("round-trips a Unicode user and rolls back identity with accompanying project changes", () => {
  const tx = withLock(root, "project", () => transact(root, changesFor(root, { ...localUserFiles("  张 三  "), "project.txt": "new" })));
  expect(readLocalUser(root)).toBe("张 三");
  recover(root, tx.id, true);
  expect(readLocalUser(root)).toBeUndefined();
  expect(readText(root, "project.txt")).toBeNull();
});

it("rejects unsupported or empty stored identity instead of silently choosing another actor", () => {
  writeAtomic(root, ".tll/.local/user.json", '{"schemaVersion":2,"name":"Alice"}');
  expect(() => readLocalUser(root)).toThrow("Unknown local user version");
  writeAtomic(root, ".tll/.local/user.json", '{"schemaVersion":1,"name":" "}');
  expect(() => readLocalUser(root)).toThrow("nonempty");
  expect(() => localUserFiles(" ")).toThrow("nonempty");
});
