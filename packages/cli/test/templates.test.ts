import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterEach, expect, it } from "vitest";
import { applyMigration, directoryMigration, hash, json, planMigration, readText, writeAtomic } from "@trellis-lite/core";
import { install } from "../src/templates.js";
import { ENTRY } from "../src/platforms.js";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "tll-templates-")); });
afterEach(async () => { await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 10 }); });

it("initializes only the TLL namespace and uses TLL platform entry points", () => {
  install(root, { platforms: ["codex", "claude", "cursor"] });
  expect(fs.existsSync(path.join(root, ".trellis"))).toBe(false);
  expect(readText(root, ".tll/config.yaml")).toContain("product: tll");
  expect(readText(root, "AGENTS.md")).toContain("<!-- TLL:START -->");
  expect(readText(root, "AGENTS.md")).not.toContain(".trellis");
  expect(readText(root, ".cursor/rules/tll.mdc")).not.toBeNull();
});

it("does not overwrite user edits inside a previously generated managed block", () => {
  install(root);
  const customized = (readText(root, "AGENTS.md") ?? "").replace("Main agent owns delivery.", "Use a custom team process.");
  writeAtomic(root, "AGENTS.md", customized);
  expect(() => install(root)).toThrow("Modified managed block");
  expect(readText(root, "AGENTS.md")).toBe(customized);
});

it("accepts quoted YAML product values and preserves custom project knowledge", () => {
  install(root);
  writeAtomic(root, ".tll/config.yaml", 'schemaVersion: 1\nproduct: "tll"\ncontextBudget: 2048\n');
  writeAtomic(root, ".tll/project.md", "# Our conventions\nKeep me.\n");
  expect(install(root).changed).toEqual([]);
  expect(readText(root, ".tll/project.md")).toContain("Keep me");
});

it("upgrades old Lite blocks and cursor rules while preserving user text and platform selection", () => {
  const oldEntry = ENTRY.replaceAll(".tll/", ".trellis/").replace("# TLL", "# Trellis Lite").replace("TLL stores", "Trellis stores");
  const block = `<!-- TRELLIS-LITE:START -->\n${oldEntry}<!-- TRELLIS-LITE:END -->`;
  const claude = "<!-- TRELLIS-LITE:START -->\nRead AGENTS.md for portable task context and handoff.\n<!-- TRELLIS-LITE:END -->";
  writeAtomic(root, "AGENTS.md", `# Custom team rule\n\n${block}\n`);
  writeAtomic(root, "CLAUDE.md", `${claude}\nKeep custom guidance.\n`);
  writeAtomic(root, ".cursor/rules/trellis-lite.mdc", "---\nalwaysApply: true\n---\nRead AGENTS.md for portable task context and handoff.\n");
  writeAtomic(root, ".trellis/config.yaml", "schemaVersion: 1\nproduct: trellis-lite\n");
  writeAtomic(root, ".trellis/.lite-templates.json", json({ schemaVersion: 1, hashes: { "AGENTS.md#block": hash(block), "CLAUDE.md#block": hash(claude) }, platforms: ["codex", "claude", "cursor"], hooks: [] }));
  directoryMigration(root, true);
  applyMigration(root, planMigration(root));
  install(root);
  expect(readText(root, "AGENTS.md")).toContain("Custom team rule");
  expect(readText(root, "AGENTS.md")).not.toContain("TRELLIS-LITE");
  expect(readText(root, "AGENTS.md")).not.toContain(".trellis/");
  expect(readText(root, "CLAUDE.md")).toContain("Keep custom guidance");
  expect(readText(root, ".cursor/rules/trellis-lite.mdc")).toBeNull();
  expect(readText(root, ".cursor/rules/tll.mdc")).not.toBeNull();
  expect(install(root).changed).toEqual([]);
});

it("refuses customized old managed blocks instead of appending a second block", () => {
  const original = "<!-- TRELLIS-LITE:START -->\nOriginal\n<!-- TRELLIS-LITE:END -->";
  const custom = original.replace("Original", "User edits");
  writeAtomic(root, "AGENTS.md", custom);
  writeAtomic(root, ".tll/.lite-templates.json", json({ schemaVersion: 1, hashes: { "AGENTS.md#block": hash(original) }, platforms: [], hooks: [] }));
  expect(() => install(root)).toThrow("Modified managed block");
  expect(readText(root, "AGENTS.md")).toBe(custom);
});
