import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { LiteError, json, object, readSession, requiredText, type JsonObject, type Session } from "@trellis-lite/core";
import { git } from "./git.js";

export interface Runtime { root: string; session?: string; actor?: string; platform: string; readOnly: boolean }

export function runtime(command: Command): Runtime {
  const options = command.optsWithGlobals();
  return { root: path.resolve(String(options.root ?? process.cwd())), session: options.session ?? process.env.TLL_SESSION, actor: options.actor, platform: String(options.platform ?? "generic"), readOnly: options.readOnly === true || process.env.TLL_READ_ONLY === "1" };
}

export function writable(env: Runtime): void {
  if (env.readOnly) throw new LiteError("READ_ONLY", "Native plan/read-only mode forbids persistence and Git writes");
}

export function session(env: Runtime): Session {
  return readSession(env.root, requiredText(env.session, "--session or TLL_SESSION"));
}

export function actor(env: Runtime): string {
  return env.actor ?? (env.session ? session(env).actor.human : git(env.root, ["config", "user.name"]));
}

export function inputFile(file: string): JsonObject {
  return object(JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")));
}

export function optionalText(file: unknown): string | undefined {
  return typeof file === "string" ? fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "") : undefined;
}

export function output(value: unknown): void {
  const data = value && typeof value === "object" && !Array.isArray(value) ? object(value) : { result: value };
  const payload = "hookSpecificOutput" in data || "additional_context" in data ? data : { schemaVersion: 1, ...data };
  process.stdout.write(json(payload));
}

export function wrap(action: () => unknown): void {
  output(action());
}
