import { changesFor, hash, json, LiteError, localUserFiles, object, readConfig, readText, transact, withLock, type Change, type JsonObject } from "@trellis-lite/core";
import { ENTRY, HOOK_PLATFORMS, PLATFORMS, hookConfig } from "./platforms.js";

const MANIFEST = ".tll/.lite-templates.json";
const START = "<!-- TLL:START -->";
const END = "<!-- TLL:END -->";
const POINTER = `${START}\n${ENTRY}${END}`;
const BASE: Record<string, string> = {
  ".tll/config.yaml": "schemaVersion: 1\nproduct: tll\ncontextBudget: 16384\nautoCommit: off\n",
  ".tll/project.md": "# Project\n\nDescribe purpose, repository layout and verification commands here.\n",
  ".tll/.gitignore": "/.local/\n",
};

interface TemplateManifest { schemaVersion: 1; hashes: Record<string, string>; platforms: string[]; hooks: string[] }
export interface InstallPlan { changes: Change[]; conflicts: string[]; warnings: string[] }

function readManifest(root: string): TemplateManifest {
  const text = readText(root, MANIFEST);
  if (text === null) return { schemaVersion: 1, hashes: {}, platforms: [], hooks: [] };
  const data = object(JSON.parse(text));
  if (data.schemaVersion !== 1 || !Array.isArray(data.platforms) || !Array.isArray(data.hooks)) throw new LiteError("INVALID_MANIFEST", "Unknown template manifest");
  if (!Object.values(object(data.hashes)).every((item) => typeof item === "string")) throw new LiteError("INVALID_MANIFEST", "Invalid hashes");
  const manifest = data as unknown as TemplateManifest;
  manifest.hashes = Object.fromEntries(Object.entries(manifest.hashes).map(([key, value]) => [key.replace(/^\.trellis\//, ".tll/"), value]));
  return manifest;
}

function mergePointer(text: string, block = POINTER, expectedHash?: string): string {
  const oldStart = "<!-- TRELLIS-LITE:START -->";
  const oldEnd = "<!-- TRELLIS-LITE:END -->";
  const legacy = text.includes(oldStart) || text.includes(oldEnd);
  if (legacy && (text.includes(START) || text.includes(END))) throw new LiteError("CONFLICT", "Both old and new managed blocks exist; merge manually");
  const opening = legacy ? oldStart : START;
  const closing = legacy ? oldEnd : END;
  const start = text.indexOf(opening);
  const end = text.indexOf(closing);
  if (start < 0 && end < 0) return `${text.trimEnd()}\n\n${block}\n`.trimStart();
  if (start < 0 || end < start || text.indexOf(opening, start + opening.length) >= 0) throw new LiteError("CONFLICT", "Malformed TLL managed block");
  const current = text.slice(start, end + closing.length);
  if (current !== block && hash(current) !== expectedHash) throw new LiteError("TEMPLATE_CONFLICT", "Modified managed block; preserve or merge the local changes before update");
  return text.slice(0, start) + block + text.slice(end + closing.length);
}

function mergeHooks(root: string, platform: string): { path: string; text: string } {
  const config = hookConfig(platform);
  const old = readText(root, config.path);
  const data = old === null ? {} : object(JSON.parse(old));
  const hooks = data.hooks === undefined ? {} : object(data.hooks);
  const list = hooks[config.event] ?? [];
  if (!Array.isArray(list)) throw new LiteError("CONFLICT", `${config.path}: invalid hook list`);
  const duplicate = list.some((entry: unknown) => JSON.stringify(entry) === JSON.stringify(config.item));
  if (!duplicate) list.push(config.item);
  hooks[config.event] = list;
  data.hooks = hooks;
  if (platform === "cursor" && data.version === undefined) data.version = 1;
  return { path: config.path, text: json(data) };
}

export function planInstall(root: string, options: { platforms?: string[]; hooks?: boolean; user?: string } = {}): InstallPlan {
  const manifest = readManifest(root);
  const platforms = [...new Set([...manifest.platforms, ...(options.platforms ?? [])])];
  for (const item of platforms) if (!PLATFORMS.some((id) => id === item)) throw new LiteError("INVALID_PLATFORM", item);
  const plan: InstallPlan = { changes: [], conflicts: [], warnings: [] };
  const desired: Record<string, string> = {};
  for (const [key, text] of Object.entries(BASE)) {
    const old = readText(root, key);
    if (old !== null && old !== text && manifest.hashes[key] !== hash(old)) {
      // project/config 是用户知识，不以模板升级覆盖。
      if (!key.endsWith("project.md") && !key.endsWith("config.yaml")) plan.conflicts.push(`Modified template: ${key}`);
      continue;
    }
    desired[key] = text;
    manifest.hashes[key] = hash(text);
  }
  desired["AGENTS.md"] = mergePointer(readText(root, "AGENTS.md") ?? "", POINTER, manifest.hashes["AGENTS.md#block"]);
  manifest.hashes["AGENTS.md#block"] = hash(POINTER);
  for (const platform of platforms) addPlatform(root, platform, { desired, plan, hashes: manifest.hashes, hooks: options.hooks === true || manifest.hooks.includes(platform) });
  manifest.platforms = platforms;
  if (options.hooks) manifest.hooks = [...new Set([...manifest.hooks, ...platforms.filter((item) => HOOK_PLATFORMS.includes(item))])];
  desired[MANIFEST] = json(manifest);
  if (options.user !== undefined) Object.assign(desired, localUserFiles(options.user));
  plan.changes.push(...changesFor(root, desired));
  return plan;
}

function addPlatform(root: string, platform: string, state: { desired: Record<string, string>; plan: InstallPlan; hashes: Record<string, string>; hooks: boolean }): void {
  if (platform === "claude") {
    const block = `${START}\nRead AGENTS.md for portable task context and handoff.\n${END}`;
    state.desired["CLAUDE.md"] = mergePointer(readText(root, "CLAUDE.md") ?? "", block, state.hashes["CLAUDE.md#block"]);
    state.hashes["CLAUDE.md#block"] = hash(block);
  }
  if (platform === "cursor") {
    const key = ".cursor/rules/tll.mdc";
    const text = "---\nalwaysApply: true\n---\nRead AGENTS.md for portable task context and handoff.\n";
    const legacyKey = ".cursor/rules/trellis-lite.mdc";
    const legacy = readText(root, legacyKey);
    if (legacy === text) state.plan.changes.push(...changesFor(root, { [legacyKey]: null }));
    else if (legacy !== null) state.plan.conflicts.push(`Custom legacy platform rule: ${legacyKey}`);
    const old = readText(root, key);
    if (old === null || old === text) state.desired[key] = text;
    else state.plan.conflicts.push(`Custom platform rule: ${key}`);
  }
  if (!state.hooks || !HOOK_PLATFORMS.includes(platform)) return;
  const config = mergeHooks(root, platform);
  state.desired[config.path] = config.text;
  state.plan.warnings.push(`${platform}: hook needs tll on the host PATH and host approval; shared-entry fallback remains available. Live host not verified.`);
}

export function install(root: string, options: { platforms?: string[]; hooks?: boolean; dryRun?: boolean; user?: string } = {}): JsonObject {
  const config = readConfig(root);
  if (config !== null && config.product !== "tll") throw new LiteError("MIGRATION_REQUIRED", "Run tll migrate --dry-run, then --apply before init/update");
  if (options.dryRun) return { schemaVersion: 1, ...planInstall(root, options) };
  return withLock(root, "project", () => {
    const plan = planInstall(root, options);
    if (plan.conflicts.length) throw new LiteError("TEMPLATE_CONFLICT", plan.conflicts.join("\n"));
    const tx = transact(root, plan.changes);
    return { schemaVersion: 1, changed: plan.changes.map((item) => item.path), warnings: plan.warnings, transaction: tx.id, ...(options.user === undefined ? {} : { user: options.user }) };
  });
}
