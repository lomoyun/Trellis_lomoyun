import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterEach, expect, it } from "vitest";
import { readText, writeAtomic } from "@trellis-lite/core";
import { install } from "../src/templates.js";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "tll-templates-")); });
afterEach(async () => { await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 10 }); });

it("does not overwrite user edits inside a previously generated managed block", () => {
  install(root);
  const customized = (readText(root, "AGENTS.md") ?? "").replace("Use one main agent.", "Use a custom team process.");
  writeAtomic(root, "AGENTS.md", customized);
  expect(() => install(root)).toThrow("Modified managed block");
  expect(readText(root, "AGENTS.md")).toBe(customized);
});

it("accepts quoted YAML product values and preserves custom project knowledge", () => {
  install(root);
  writeAtomic(root, ".trellis/config.yaml", 'schemaVersion: 1\nproduct: "trellis-lite"\ncontextBudget: 2048\n');
  writeAtomic(root, ".trellis/project.md", "# Our conventions\nKeep me.\n");
  expect(install(root).changed).toEqual([]);
  expect(readText(root, ".trellis/project.md")).toContain("Keep me");
});
