import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repository = fs.realpathSync(fileURLToPath(new URL("../", import.meta.url)));
const cwd = fs.realpathSync(process.cwd());
const allowed = ["core", "cli"].map((name) => path.join(repository, "packages", name));
if (!allowed.includes(cwd)) throw new Error("Build clean must run inside a known package");
const target = path.join(cwd, "dist");
if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error("Refusing a linked dist directory");
fs.rmSync(target, { recursive: true, force: true });
