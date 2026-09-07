import { Command, CommanderError } from "commander";
import { context, LiteError, readSession } from "@trellis-lite/core";
import { adminCommands } from "./admin-commands.js";
import { checkpointCommand, taskCommands } from "./task-commands.js";
import { output, runtime, wrap } from "./runtime.js";

export function cli(argv: string[]): void {
  const program = new Command().name("tll").description("Trellis Lite: portable Task / PRD / Plan / Trace").version("0.1.0")
    .option("--root <directory>", "Project root (default: cwd)").option("--session <uuid>", "Local session UUID")
    .option("--actor <human>", "Human identity (default: Git user.name)").option("--platform <id>", "Host platform", "generic")
    .option("--read-only", "Disallow persistence in native plan mode").option("--json", "Versioned JSON output (the default)");
  program.exitOverride();
  adminCommands(program);
  taskCommands(program);
  checkpointCommand(program, "checkpoint");
  checkpointCommand(program, "handoff", "handoff");
  program.command("context [id]").option("--budget <bytes>").option("--spec <paths...>").action((id: string | undefined, options) => wrap(() => {
    const env = runtime(program);
    return context(env.root, { id, session: env.session && !id ? readSession(env.root, env.session) : undefined, budget: options.budget === undefined ? undefined : Number(options.budget), specs: options.spec });
  }));
  try { program.parse(argv); }
  catch (error) {
    if (error instanceof CommanderError && error.exitCode === 0) return;
    output({ schemaVersion: 1, error: { code: error instanceof LiteError ? error.code : "COMMAND_FAILED", message: error instanceof Error ? error.message : String(error) } });
    process.exitCode = 1;
  }
}
