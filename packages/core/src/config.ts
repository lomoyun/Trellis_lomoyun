import { parse } from "yaml";
import { readText } from "./files.js";
import { LiteError, object, type JsonObject } from "./model.js";

export function readConfig(root: string): JsonObject | null {
  const text = readText(root, ".trellis/config.yaml");
  return text === null ? null : object(parse(text));
}

export function contextBudget(root: string, fallback: number): number {
  const config = readConfig(root);
  if (config?.product !== "trellis-lite") return fallback;
  const budget = config.contextBudget ?? fallback;
  if (!Number.isSafeInteger(budget) || Number(budget) < 1024) throw new LiteError("INVALID_CONFIG", "contextBudget must be an integer >= 1024");
  return Number(budget);
}
