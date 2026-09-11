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
  root = fs.mkdtempSync(path.join(os.tmpdir(), "tll-init-user-"));
  git(root, ["init", "-q"]);
  git(root, ["config", "user.name", "Git User"]);
  git(root, ["config", "user.email", "fixture@example.test"]);
});
afterEach(async () => { await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });

function run(args: string[]) {
  const result = spawnSync(process.execPath, [bin, "--root", root, ...args], { encoding: "utf8", windowsHide: true });
  return { status: result.status, data: JSON.parse(result.stdout || "{}") };
}

it("registers the Git username locally without creating sessions or granting permissions", () => {
  expect(run(["init", "--platforms", "codex"]).status).toBe(0);
  expect(JSON.parse(readText(root, ".tll/.local/user.json") ?? "null")).toEqual({ schemaVersion: 1, name: "Git User" });
  expect(fs.existsSync(path.join(root, ".tll/.local/sessions"))).toBe(false);
  expect(run(["policy", "show"]).data.policy).toBeNull();
  expect(git(root, ["status", "--porcelain", "--ignored", "--untracked-files=all", "--", ".tll/.local/user.json"])).toBe("!! .tll/.local/user.json");
  expect(readText(root, ".tll/config.yaml")).not.toContain("Git User");
});

it("supports -u and --user, preserves registration on repeat init and update", () => {
  expect(run(["init", "-u", "lomoyun"]).status).toBe(0);
  expect(run(["init"]).data.changed).toEqual([]);
  expect(run(["update"]).status).toBe(0);
  expect(readText(root, ".tll/.local/user.json")).toContain("lomoyun");
  expect(run(["init", "--user", "张 三"]).status).toBe(0);
  expect(readText(root, ".tll/.local/user.json")).toContain("张 三");
  expect(git(root, ["config", "user.name"])).toBe("Git User");
});

it("uses registered users for new tasks and sessions with temporary and session overrides", () => {
  expect(run(["init", "-u", "Alice"]).status).toBe(0);
  expect(run(["task", "new", "One", "--id", "one"]).data.meta.creator).toBe("Alice");
  const session = run(["--platform", "codex", "session", "new"]).data;
  expect(session.actor).toEqual({ human: "Alice", platform: "codex" });
  expect(run(["init", "-u", "Bob"]).status).toBe(0);
  expect(run(["--session", session.id, "task", "new", "Two", "--id", "two"]).data.meta.creator).toBe("Alice");
  expect(run(["--session", session.id, "--actor", "Carol", "task", "new", "Three", "--id", "three"]).data.meta.creator).toBe("Carol");
  expect(run(["session", "new"]).data.actor.human).toBe("Bob");
  expect(readText(root, ".tll/.local/user.json")).toContain("Bob");
});

it("does not write identity during previews, read-only mode or template conflicts", () => {
  expect(run(["init", "-u", "Alice", "--dry-run"]).status).toBe(0);
  expect(fs.existsSync(path.join(root, ".tll"))).toBe(false);
  expect(run(["--read-only", "init", "-u", "Alice"]).data.error.code).toBe("READ_ONLY");
  expect(fs.existsSync(path.join(root, ".tll"))).toBe(false);
  expect(run(["init", "-u", "Alice"]).status).toBe(0);
  writeAtomic(root, "AGENTS.md", (readText(root, "AGENTS.md") ?? "").replace("Main agent owns delivery.", "User-owned change."));
  expect(run(["init", "-u", "Bob"]).status).toBe(1);
  expect(readText(root, ".tll/.local/user.json")).toContain("Alice");
});

it("reports missing Git identity and rejects blank explicit names without initializing", () => {
  git(root, ["config", "user.name", ""]);
  expect(run(["init"]).data.error.code).toBe("USER_REQUIRED");
  expect(fs.existsSync(path.join(root, ".tll"))).toBe(false);
  expect(run(["init", "-u", "   "]).status).toBe(1);
  expect(fs.existsSync(path.join(root, ".tll"))).toBe(false);
  expect(run(["init", "-u", "Explicit"]).status).toBe(0);
});

it("isolates default users between projects and retains Git fallback before registration", () => {
  expect(run(["task", "new", "Legacy", "--id", "legacy"]).data.meta.creator).toBe("Git User");
  expect(run(["init", "-u", "Alice"]).status).toBe(0);
  const other = path.join(root, "other-project");
  fs.mkdirSync(other);
  git(other, ["init", "-q"]);
  git(other, ["config", "user.name", "Other User"]);
  expect(run(["--root", other, "init"]).data.user).toBe("Other User");
  expect(run(["--root", other, "session", "new"]).data.actor.human).toBe("Other User");
  expect(run(["session", "new"]).data.actor.human).toBe("Alice");
});

it("keeps an existing default during preview and reports invalid user records", () => {
  expect(run(["init", "-u", "Alice"]).status).toBe(0);
  expect(run(["init", "-u", "Bob", "--dry-run"]).status).toBe(0);
  expect(readText(root, ".tll/.local/user.json")).toContain("Alice");
  writeAtomic(root, ".tll/.local/user.json", '{"schemaVersion":2,"name":"Bad"}');
  expect(run(["session", "new"]).data.error.code).toBe("INVALID_USER");
  expect(run(["init", "-u", "Recovered"]).status).toBe(0);
  expect(run(["session", "new"]).data.actor.human).toBe("Recovered");
});
