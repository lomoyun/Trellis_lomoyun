import { assertNamespace, json, readText } from "./files.js";
import { LiteError, object, requiredText } from "./model.js";

const USER_FILE = ".tll/.local/user.json";

export function readLocalUser(root: string): string | undefined {
  assertNamespace(root);
  const text = readText(root, USER_FILE);
  if (text === null) return undefined;
  const data = object(JSON.parse(text));
  if (data.schemaVersion !== 1) throw new LiteError("INVALID_USER", "Unknown local user version; register with tll init -u <name>");
  return requiredText(data.name, "local user name").trim();
}

/** 与模板变更一起进入事务；身份不是共享模板，也不是提交授权。 */
export function localUserFiles(name: string): Record<string, string> {
  return { [USER_FILE]: json({ schemaVersion: 1, name: requiredText(name, "--user").trim() }) };
}
