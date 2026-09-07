import fs from "node:fs";
import { Command } from "commander";
import { applyMigration, createSession, nativeAdvice, planMigration, recover, requiredText } from "@trellis-lite/core";
import { grantPolicy, readPolicy, revokePolicy } from "./policy.js";
import { actor, inputFile, runtime, wrap, writable } from "./runtime.js";
import { hookOutput, platformReport } from "./platforms.js";
import { install } from "./templates.js";

export function adminCommands(program: Command): void {
  for (const command of ["init", "update"]) program.command(command).option("--platforms <ids>", "Comma-separated platform IDs").option("--hooks", "Install opt-in session-start hooks").option("--dry-run").action((options) => wrap(() => {
    const env = runtime(program);
    if (!options.dryRun) writable(env);
    return install(env.root, { platforms: options.platforms?.split(","), hooks: options.hooks, dryRun: options.dryRun });
  }));
  program.command("platforms").action(() => wrap(platformReport));
  program.command("native").requiredOption("--input <file>").action((options) => wrap(() => nativeAdvice(inputFile(options.input))));
  program.command("hook").action(() => wrap(() => {
    const env = runtime(program);
    const payload: unknown = JSON.parse(fs.readFileSync(0, "utf8"));
    return hookOutput(env.root, env.platform, payload);
  }));
  migrationCommands(program);
  sessionCommands(program);
  policyCommands(program);
}

function migrationCommands(program: Command): void {
  program.command("migrate").option("--dry-run").option("--apply").action((options) => wrap(() => {
    const env = runtime(program);
    const plan = planMigration(env.root);
    if (!options.apply || options.dryRun) return plan;
    writable(env);
    return { schemaVersion: 1, transaction: applyMigration(env.root, plan), warnings: plan.warnings };
  }));
  program.command("recover <transaction>").option("--rollback").action((id: string, options) => wrap(() => {
    const env = runtime(program); writable(env);
    return recover(env.root, id, options.rollback);
  }));
}

function sessionCommands(program: Command): void {
  const command = program.command("session");
  command.command("new").option("--native-session <id>", "Map host session locally; never written to shared trace").action((options) => wrap(() => {
    const env = runtime(program); writable(env);
    return createSession(env.root, { human: actor(env), platform: env.platform }, options.nativeSession);
  }));
}

function policyCommands(program: Command): void {
  const policy = program.command("policy");
  policy.command("show").action(() => wrap(() => ({ schemaVersion: 1, policy: readPolicy(runtime(program).root) })));
  policy.command("grant").requiredOption("--scope <scope>", "records or task").requiredOption("--duration <duration>", "session, task or repo-user").option("--task <id>").requiredOption("--ack <consent>", "Human authorization: allow-local-commits").action((options) => wrap(() => {
    const env = runtime(program); writable(env);
    return grantPolicy(env.root, { ...options, session: env.session });
  }));
  policy.command("revoke").action(() => wrap(() => {
    const env = runtime(program); writable(env);
    revokePolicy(env.root);
    return { schemaVersion: 1, revoked: true };
  }));
}

export function requiredTask(id: unknown): string {
  return requiredText(id, "task");
}
