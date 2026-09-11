import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { afterEach, beforeEach, expect, it } from "vitest";
import { bindSession, createSession, createTask, readTrace, writeAtomic } from "../src/index.js";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "tll-concurrency-")); });
afterEach(async () => { await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });

function writer(args: string[]): Promise<number | null> {
  const script = `import {checkpoint,readSession} from ${JSON.stringify(new URL("../dist/index.js", import.meta.url).href)};
const [root,session,key,revision] = process.argv.slice(1);
for (let attempt=0; attempt<100; attempt++) {
  try {
    checkpoint(root, 'same', {session:readSession(root,session), input:{schemaVersion:1,key,type:'checkpoint',summary:key,expectedRevision:revision}});
    break;
  } catch(error) {
    if(error.code!=='LOCKED' || attempt===99) throw error;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
}`;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", script, ...args], { windowsHide: true, stdio: "pipe" });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve(code) : reject(new Error(stderr)));
  });
}

it("serializes independent processes appending to the same session trace", async () => {
  const task = createTask(root, { id: "same", title: "Concurrent", actor: "alice" });
  const local = bindSession(root, createSession(root, { human: "alice", platform: "codex" }).id, "same");
  await Promise.all([writer([root, local.id, "a", task.revision]), writer([root, local.id, "b", task.revision])]);
  expect(readTrace(root, "same").map((event) => event.seq)).toEqual([1, 2]);
  expect(new Set(readTrace(root, "same").map((event) => event.key))).toEqual(new Set(["a", "b"]));
});

it("does not steal a lock just because its timestamp is old", async () => {
  writeAtomic(root, ".tll/.local/locks/project.lock", '{"pid":1,"at":"2000-01-01"}');
  expect(() => createTask(root, { title: "No", actor: "alice" })).toThrow("another writer");
});
