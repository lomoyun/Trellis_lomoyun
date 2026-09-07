import { spawnSync } from "node:child_process";
import { LiteError } from "@trellis-lite/core";

export function git(root: string, args: string[]): string {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_") || key === "GIT_EXEC_PATH"));
  const result = spawnSync("git", ["--literal-pathspecs", "-c", "core.quotepath=false", "-c", "i18n.logOutputEncoding=UTF-8", ...args], { cwd: root, env, encoding: "utf8", windowsHide: true, timeout: 30_000 });
  if (result.error || result.status !== 0) throw new LiteError("GIT_FAILED", result.error?.message ?? result.stderr.trim());
  return result.stdout.trimEnd();
}

export function gitIdentity(root: string): string {
  const name = git(root, ["config", "user.name"]);
  const email = git(root, ["config", "user.email"]);
  if (!name || !email) throw new LiteError("GIT_IDENTITY", "Configure local Git user.name and user.email first");
  return `${name} <${email}>`;
}

export function gitHead(root: string): string | null {
  try { return git(root, ["rev-parse", "--verify", "HEAD"]); }
  catch { return null; }
}

export function stagedPaths(root: string): string[] {
  return git(root, ["diff", "--cached", "--name-only", "-z"]).split("\0").filter(Boolean);
}
