import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it } from "vitest";
import { bindSession, checkpoint, createSession, createTask, writeAtomic } from "@trellis-lite/core";

const bin = fileURLToPath(new URL("../bin/tll.js", import.meta.url));
let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "tll-cli-budget-")); });
afterEach(async () => { await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 10 }); });

it("keeps project and event summaries in built context and mapped read-only hooks", () => {
  const task = createTask(root, { id: "large", title: "Large", actor: "alice", prd: "验收".repeat(8000) });
  writeAtomic(root, ".tll/project.md", "# Project\nUseful project context.\n");
  for (const platform of ["codex", "claude", "cursor"]) {
    const session = bindSession(root, createSession(root, { human: "alice", platform }, "native-fixture").id, "large");
    checkpoint(root, "large", { session, input: { schemaVersion: 1, key: platform, type: "verify", summary: `${platform} verification`, expectedRevision: task.revision, evidence: { log: "FULL_EVIDENCE_ONLY".repeat(2000) } } });
  }
  const before = fs.readdirSync(root, { recursive: true }).sort();
  for (const platform of ["context", "codex", "claude", "cursor"]) {
    const args = platform === "context" ? ["context", "large"] : ["--platform", platform, "hook"];
    const run = spawnSync(process.execPath, [bin, "--root", root, "--read-only", ...args], { encoding: "utf8", windowsHide: true, input: JSON.stringify({ session_id: "native-fixture" }) });
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(run.stdout).toContain("Useful project context");
    expect(run.stdout).toContain("codex verification");
    expect(run.stdout).toContain("independent deliverables");
    expect(run.stdout).not.toContain("FULL_EVIDENCE_ONLY");
    if (platform === "context") expect(Buffer.byteLength(JSON.stringify(JSON.parse(run.stdout)))).toBeLessThanOrEqual(16384);
  }
  expect(fs.readdirSync(root, { recursive: true }).sort()).toEqual(before);
}, 30_000);
