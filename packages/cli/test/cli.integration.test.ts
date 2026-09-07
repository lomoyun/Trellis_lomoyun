import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it } from "vitest";
import { readText, writeAtomic } from "@trellis-lite/core";
import { git } from "../src/git.js";

const bin = fileURLToPath(new URL("../bin/tll.js", import.meta.url));
let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "tll-cli-"));
  git(root, ["init", "-q"]);
  git(root, ["config", "user.name", "Alice"]);
  git(root, ["config", "user.email", "alice@example.test"]);
});
afterEach(async () => { await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });

function run(args: string[], input?: unknown): { status: number | null; data: Record<string, unknown>; output: string } {
  const result = spawnSync(process.execPath, [bin, "--root", root, ...args], { input: input === undefined ? undefined : JSON.stringify(input), encoding: "utf8", windowsHide: true });
  return { status: result.status, data: result.stdout ? JSON.parse(result.stdout) : {}, output: result.stdout + result.stderr };
}

function files(directory = root): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git" || entry.name === ".local") return [];
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? files(full) : [path.relative(root, full).replace(/\\/g, "/")];
  });
}

it("installs at most five shared files and updates idempotently", () => {
  expect(run(["init"]).status).toBe(0);
  expect(files().length).toBeLessThanOrEqual(5);
  expect(files().reduce((sum, key) => sum + Buffer.byteLength(readText(root, key) ?? ""), 0)).toBeLessThanOrEqual(30 * 1024);
  expect(run(["update", "--dry-run"]).data.changes).toEqual([]);
  expect(run(["update"]).data.changed).toEqual([]);
});

it("preserves custom AGENTS and hook entries without installing subagents", () => {
  writeAtomic(root, "AGENTS.md", "# Team conventions\nNever discard user edits.\n");
  writeAtomic(root, ".claude/settings.json", JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: "command", command: "echo custom" }] }] }, theme: "dark" }));
  expect(run(["init", "--platforms", "claude,codex,cursor", "--hooks"]).status).toBe(0);
  expect(readText(root, "AGENTS.md")).toContain("Never discard user edits");
  expect(readText(root, ".claude/settings.json")).toContain("echo custom");
  expect(files().some((key) => key.includes("/agents/") || key.endsWith(".py"))).toBe(false);
  expect(run(["update", "--dry-run"]).data.changes).toEqual([]);
  for (const prefix of [".codex/", ".claude/", ".cursor/"]) expect(files().filter((file) => file.startsWith(prefix)).length).toBeLessThanOrEqual(4);
});

it("hooks are read-only and return host-specific context", () => {
  run(["init"]);
  const before = git(root, ["status", "--porcelain", "--untracked-files=all"]);
  for (const platform of ["claude", "codex", "cursor"]) {
    const result = run(["--platform", platform, "hook"], { session_id: "native-session", permission_mode: "plan" });
    expect(result.status).toBe(0);
    expect(result.data).toHaveProperty(platform === "cursor" ? "additional_context" : "hookSpecificOutput.additionalContext");
  }
  expect(git(root, ["status", "--porcelain", "--untracked-files=all"])).toBe(before);
});

it("blocks all mutations in plan/read-only mode", () => {
  const before = files();
  expect(run(["--read-only", "init"]).data).toHaveProperty("error.code", "READ_ONLY");
  expect(run(["--read-only", "task", "new", "Must not exist"]).data).toHaveProperty("error.code", "READ_ONLY");
  expect(run(["--read-only", "session", "new"]).data).toHaveProperty("error.code", "READ_ONLY");
  expect(files()).toEqual(before);
  expect(fs.existsSync(path.join(root, ".trellis"))).toBe(false);
});

it("runs task/new/start/import/checkpoint/handoff/finish from built CLI", () => {
  run(["init"]);
  const created = run(["task", "new", "可追溯", "--id", "demo"]);
  expect(created.status).toBe(0);
  expect(created.data.schemaVersion).toBe(1);
  expect(run(["--session", "missing-session", "context", "demo"]).status).toBe(0);
  const local = run(["--actor", "Alice", "--platform", "codex", "session", "new"]);
  const session = String(local.data.id);
  expect(run(["--session", session, "task", "start", "demo", "--expect", String(created.data.revision)]).status).toBe(0);
  const started = run(["task", "show", "demo"]);
  const plan = "# Confirmed native plan\n- [x] S1: 保留原生步骤\n- [ ] S2: Verify\n";
  writeAtomic(root, "confirmed.md", plan);
  expect(run(["task", "update", "demo", "--expect", String(started.data.revision), "--plan", path.join(root, "confirmed.md")]).status).toBe(0);
  const imported = run(["task", "show", "demo"]);
  expect(imported.data.plan).toBe(plan);
  const base = ["--session", session];
  for (const command of ["checkpoint", "handoff"]) {
    const result = run([...base, command, "demo", "--expect", String(imported.data.revision), "--summary", "Imported confirmed plan", "--key", command]);
    expect(result.status).toBe(0);
    expect(result.data).toHaveProperty("git.status", "off");
  }
  expect(run([...base, "task", "finish", "demo", "--expect", String(imported.data.revision), "--summary", "Complete", "--key", "finish"]).status).toBe(0);
  expect(run(["task", "show", "demo"]).data).toHaveProperty("meta.status", "done");
  expect(files().some((file) => file.startsWith(".trellis/workspace/") && file.endsWith(".md"))).toBe(true);
}, 30_000);
