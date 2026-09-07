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
  const init = tll(["init"]);
  const sharedFiles = fs.readdirSync(path.join(project, ".trellis")).filter((name) => name !== ".local").length + 1;
  assert.equal(sharedFiles, 5);
  const task = tll(["--actor", "smoke", "task", "new", "Packed task", "--id", "packed"]);
  assert.equal(task.meta.id, "packed");
  const session = tll(["--actor", "smoke", "session", "new"]);
  const started = tll(["--session", session.id, "task", "start", "packed", "--expect", task.revision]);
  const event = tll(["--session", session.id, "checkpoint", "packed", "--expect", started.task.revision, "--summary", "Packed CLI works", "--key", "packed-smoke"]);
  assert.equal(event.git.status, "off");
  assert.equal(tll(["context", "packed"]).task.id, "packed");
  assert.deepEqual(tll(["update", "--dry-run"]).changes, []);
  const manifest = JSON.parse(fs.readFileSync(path.join(installed, "package.json"), "utf8"));
  assert.equal(manifest.dependencies["@trellis-lite/core"], "0.1.0");
  console.log(JSON.stringify({ status: "passed", installMode: "prefer-offline", privateCoreOverride: true, sharedFiles, packed: packed.map((item) => ({ name: item.name, files: item.files.length })) }, null, 2));
} finally {
  await fs.promises.rm(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
