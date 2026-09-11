import { changesFor, transact, type Change, type Transaction } from "./transactions.js";
import { hash, json, readText, relativeKey, withLock } from "./files.js";
import { listTasks, taskFiles } from "./tasks.js";
import { LiteError, object } from "./model.js";
import { readConfig } from "./config.js";
import { stringify } from "yaml";

export interface MigrationPlan {
  schemaVersion: 1;
  changes: Change[];
  conflicts: string[];
  warnings: string[];
  tasks: { source: string; id: string }[];
}

export function planMigration(root: string): MigrationPlan {
  const listed = listTasks(root);
  const plan: MigrationPlan = { schemaVersion: 1, changes: [], conflicts: [...listed.warnings], warnings: [], tasks: [] };
  for (const task of listed.tasks.filter((item) => item.format === "legacy")) {
    const existingPlan = readText(root, `${task.directory}/plan.md`);
    const implement = readText(root, `${task.directory}/implement.md`);
    if (existingPlan !== null && implement !== null && hash(existingPlan) !== hash(implement)) {
      plan.conflicts.push(`${task.directory}: plan.md and implement.md differ`);
      continue;
    }
    task.format = "standard";
    plan.changes.push(...changesFor(root, taskFiles(task)));
    plan.tasks.push({ source: task.directory, id: task.meta.id });
  }
  plan.changes.push(...legacyConfig(root));
  cleanManagedEntries(root, plan);
  plan.warnings.push("Archived tasks, research, attachments, specs and developer journals are preserved. Existing Lite sessions remain local; create new sessions for new windows/devices. Pre-TLL auto-commit grants are not inherited.");
  return plan;
}

function legacyConfig(root: string): Change[] {
  const content = readText(root, ".tll/config.yaml");
  const config = readConfig(root);
  if (content === null || config?.product === "tll") return [];
  const history = ".tll/history/legacy-config.yaml";
  const existing = readText(root, history);
  if (existing !== null && existing !== content) throw new LiteError("CONFLICT", `${history} already exists`);
  const next = config?.product === "trellis-lite" ? stringify({ ...config, product: "tll", autoCommit: "off" }) : "schemaVersion: 1\nproduct: tll\ncontextBudget: 16384\nautoCommit: off\n";
  return changesFor(root, { [history]: content, ".tll/config.yaml": next });
}

function cleanManagedEntries(root: string, plan: MigrationPlan): void {
  for (const key of ["AGENTS.md", "CLAUDE.md"]) {
    const content = readText(root, key);
    if (content !== null) plan.changes.push(...changesFor(root, { [key]: content.replace(/<!-- TRELLIS:START -->[\s\S]*?<!-- TRELLIS:END -->/g, "") }));
  }
  for (const key of [".claude/settings.json", ".codex/hooks.json", ".cursor/hooks.json"]) scrubHooks(root, key, plan);
  scrubPiExtensions(root, plan);
  const manifest = readText(root, ".tll/.template-hashes.json");
  if (manifest === null) { plan.warnings.push("No legacy ownership manifest: custom or unproven files are not deleted. Review remaining old skills/hooks manually."); return; }
  const raw = object(JSON.parse(manifest));
  const hashes = object(raw.hashes ?? raw);
  for (const [rawKey, expected] of Object.entries(hashes)) {
    if (typeof expected !== "string") continue;
    const key = relativeKey(rawKey).replace(/^\.trellis\//, ".tll/");
    if (!isLegacyRuntime(key)) {
      if (/^\.[^/]+\/(?:skills|agents|hooks|commands|plugins|extensions|workflows|droids|prompts)\//.test(key) && readText(root, key) !== null) {
        const message = `Manual platform detachment required: ${key.split("/")[0]}`;
        if (!plan.conflicts.includes(message)) plan.conflicts.push(message);
      }
      continue;
    }
    const content = readText(root, key);
    if (content === null) continue;
    if (hash(content) !== expected) { plan.conflicts.push(`Modified legacy runtime: ${key}; detach it manually before migration`); continue; }
    plan.changes.push(...changesFor(root, { [key]: null }));
  }
}

function isLegacyRuntime(key: string): boolean {
  return key === ".codex/config.toml" || key.startsWith(".tll/scripts/") || key.startsWith(".tll/agents/") || /^\.(?:agents|claude|codex|cursor|opencode|pi|omp)\/(?:skills|agents|hooks|commands|plugins|extensions)\//.test(key);
}

function scrubPiExtensions(root: string, plan: MigrationPlan): void {
  const key = ".pi/settings.json";
  const text = readText(root, key);
  if (text === null) return;
  const data = object(JSON.parse(text));
  if (!Array.isArray(data.extensions)) return;
  const clean = data.extensions.filter((value: unknown) => value !== "./extensions/trellis/index.ts" && value !== "./extensions/trellis");
  if (clean.length === data.extensions.length) return;
  data.extensions = clean;
  plan.changes.push(...changesFor(root, { [key]: json(data) }));
}

function scrubHooks(root: string, key: string, plan: MigrationPlan): void {
  const text = readText(root, key);
  if (text === null) return;
  const data = object(JSON.parse(text));
  if (data.hooks === undefined) return;
  const hooks = object(data.hooks);
  let changed = false;
  for (const [event, values] of Object.entries(hooks)) {
    if (!Array.isArray(values)) { plan.conflicts.push(`Unsupported hooks shape: ${key}`); continue; }
    const cleaned = values.map((value: unknown) => cleanHookEntry(value, `${key}/${event}`, plan)).filter((value) => value !== null);
    changed = changed || JSON.stringify(values) !== JSON.stringify(cleaned);
    hooks[event] = cleaned;
  }
  if (changed) plan.changes.push(...changesFor(root, { [key]: json(data) }));
}

function cleanHookEntry(value: unknown, location: string, plan: MigrationPlan): unknown {
  const item = object(value);
  if (Array.isArray(item.hooks)) {
    const hooks = item.hooks.map((hook: unknown) => cleanHookEntry(hook, location, plan)).filter((hook) => hook !== null);
    return hooks.length ? { ...item, hooks } : null;
  }
  if (typeof item.command !== "string") return item;
  const knownPath = /(?:\.\/)?\.(?:claude|codex|cursor)\/hooks\/(?:session-start|inject-workflow-state|inject-subagent-context|inject-shell-session-context)\.py/;
  if (!knownPath.test(item.command)) return item;
  if (!/^(?:python(?:3)?(?:\.exe)?|py(?: -3)?)\s+/.test(item.command) || /(?:&&|\|\||;)/.test(item.command)) {
    plan.conflicts.push(`Mixed or ambiguous legacy hook: ${location}`);
    return item;
  }
  return null;
}

export function applyMigration(root: string, plan: MigrationPlan): Transaction {
  if (plan.conflicts.length) throw new LiteError("MIGRATION_CONFLICT", plan.conflicts.join("\n"));
  return withLock(root, "project", () => transact(root, plan.changes));
}
