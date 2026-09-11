import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tll-pack-"));
const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error("Run through pnpm smoke:pack");
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_") && !key.startsWith("TLL_")));

function node(args, cwd = root) {
  const result = spawnSync(process.execPath, args, { cwd, env, encoding: "utf8", windowsHide: true, timeout: 120_000 });
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}\n${result.error ?? ""}`);
  return result.stdout;
}

try {
  const packed = [];
  for (const name of ["core", "cli"]) {
    const report = JSON.parse(node([pnpm, "pack", "--json", "--pack-destination", temp], path.join(root, "packages", name)));
    assert(report.files.some((file) => file.path === "LICENSE"));
    assert(report.files.some((file) => file.path === "COPYRIGHT"));
    assert(!report.files.some((file) => file.path.endsWith(".py") || /(?:channel|mem|subagent)\//.test(file.path)));
    packed.push(report);
  }
  const app = path.join(temp, "app");
  const project = path.join(temp, "project");
  fs.mkdirSync(app);
  fs.mkdirSync(project);
  const tarballs = fs.readdirSync(temp).filter((name) => name.endsWith(".tgz")).map((name) => path.join(temp, name));
  const coreTarball = tarballs.find((file) => path.basename(file).includes("-core-"));
  assert(coreTarball);
  fs.writeFileSync(path.join(app, "package.json"), JSON.stringify({ private: true, pnpm: { overrides: { "@trellis-lite/core": `file:${coreTarball.replace(/\\/g, "/")}` } } }));
  node([pnpm, "add", "--prefer-offline", "--prod", "--ignore-scripts", ...tarballs], app);
  const installed = path.join(app, "node_modules/@trellis-lite/cli");
  const bin = path.join(installed, "bin/tll.js");
  function tll(args) { return JSON.parse(node([bin, "--root", project, ...args], app)); }
  const init = tll(["init", "-u", "smoke"]);
  assert.equal(init.user, "smoke");
  const sharedFiles = fs.readdirSync(path.join(project, ".tll")).filter((name) => name !== ".local").length + 1;
  assert.equal(sharedFiles, 5);
  const entry = fs.readFileSync(path.join(project, "AGENTS.md"), "utf8").replace(/\s+/g, " ");
  for (const instruction of [
    "Main agent owns delivery.",
    "Every requested repository change belongs to a Task, including small edits",
    "Minimal write lifecycle",
    "Perform startup operations only when needed",
    "Keep revision checks, not redundant reads",
    "Default to direct execution",
    "Subagents may implement/self-test but must not mutate TLL state, commit/push or delegate",
    "Use gpt-5.6-sol / xhigh",
    "if unavailable or unconfirmable, report once and continue with the main agent, without substitution",
    "one final evidence checkpoint, then finish",
    "Never store hidden reasoning, raw chat or secrets",
    "Read-only work needs no Task lifecycle",
    "Report implementation, verification, TLL status, commit and push separately",
    "Never auto-push",
  ]) assert(entry.includes(instruction), `Packed entry missing: ${instruction}`);
  const task = tll(["task", "new", "Packed task", "--id", "packed"]);
  assert.equal(task.meta.id, "packed");
  assert.equal(task.meta.creator, "smoke");
  assert(task.prd.includes("One independently deliverable outcome"));
  const session = tll(["session", "new"]);
  assert.equal(session.actor.human, "smoke");
  const started = tll(["--session", session.id, "task", "start", "packed", "--expect", task.revision]);
  const event = tll(["--session", session.id, "checkpoint", "packed", "--expect", started.task.revision, "--summary", "Packed CLI works", "--key", "packed-smoke"]);
  assert.equal(event.git.status, "off");
  assert.equal(tll(["context", "packed"]).task.id, "packed");
  tll(["--session", session.id, "task", "finish", "packed", "--expect", started.task.revision, "--summary", "Packed delivery verified", "--key", "packed-finish"]);
  assert.deepEqual(tll(["context"]).candidates, []);
  assert.equal(tll(["context", "packed"]).task.status, "done");
  assert.deepEqual(tll(["update", "--dry-run"]).changes, []);
  const manifest = JSON.parse(fs.readFileSync(path.join(installed, "package.json"), "utf8"));
  assert.equal(manifest.dependencies["@trellis-lite/core"], "0.1.0");
  console.log(JSON.stringify({ status: "passed", installMode: "prefer-offline", privateCoreOverride: true, sharedFiles, nativeDelegationGuidance: true, packed: packed.map((item) => ({ name: item.name, files: item.files.length })) }, null, 2));
} finally {
  await fs.promises.rm(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
