import { randomUUID } from "node:crypto";
import { Command } from "commander";
import { bindSession, checkpoint, checkpointInput, createTask, expandTask, listTasks, readTask, requiredText, updateTask, type EventType, type TraceEvent } from "@trellis-lite/core";
import { autoCommit, attributeFiles } from "./autocommit.js";
import { gitHead } from "./git.js";
import { actor, inputFile, optionalText, runtime, session, wrap, writable, type Runtime } from "./runtime.js";

export function taskCommands(program: Command): void {
  const tasks = program.command("task").description("Task, PRD and Plan lifecycle");
  tasks.command("list").option("--archive", "Include legacy archive").action((options) => wrap(() => listTasks(runtime(tasks).root, options.archive)));
  tasks.command("show <id>").action((id: string) => wrap(() => readTask(runtime(tasks).root, id)));
  tasks.command("new <title>").option("--id <id>").option("--standard").option("--prd <file>").option("--plan <file>").action((title: string, options) => wrap(() => {
    const env = runtime(tasks); writable(env);
    return createTask(env.root, { title, actor: actor(env), id: options.id, format: options.standard ? "standard" : "quick", prd: optionalText(options.prd), plan: optionalText(options.plan) });
  }));
  tasks.command("update <id>").requiredOption("--expect <revision>").option("--input <file>", "Metadata patch JSON").option("--prd <file>").option("--plan <file>").action((id: string, options) => wrap(() => {
    const env = runtime(tasks); writable(env);
    return updateTask(env.root, id, { expectedRevision: options.expect, metadata: options.input ? inputFile(options.input) : undefined, prd: optionalText(options.prd), plan: optionalText(options.plan) });
  }));
  tasks.command("expand <id>").requiredOption("--expect <revision>").action((id: string, options) => wrap(() => {
    const env = runtime(tasks); writable(env);
    return expandTask(env.root, id, options.expect);
  }));
  tasks.command("start <id>").requiredOption("--expect <revision>").option("--files <paths...>", "Explicitly attributed code files; initially dirty files cannot auto-commit").action((id: string, options) => wrap(() => startTask(runtime(tasks), id, options)));
  checkpointCommand(tasks, "finish", "done");
}

function startTask(env: Runtime, id: string, options: { expect: string; files?: string[] }): unknown {
  writable(env);
  const local = session(env);
  const task = updateTask(env.root, id, { expectedRevision: options.expect, metadata: { status: "doing" } });
  const bound = bindSession(env.root, local.id, id);
  if (options.files) attributeFiles(env.root, bound, options.files);
  return { schemaVersion: 1, task, session: bound };
}

export function checkpointCommand(parent: Command, name: string, type?: EventType): void {
  parent.command(`${name} <id>`).option("--input <file>", "Versioned checkpoint JSON with stable retry key").option("--summary <text>").option("--key <key>").option("--expect <revision>").option("--files <paths...>", "Explicit whole-file attribution for an authorized task-scope commit").action((id: string, options) => wrap(() => {
    const env = runtime(parent); writable(env);
    const local = session(env);
    const input = options.input ? checkpointInput(inputFile(options.input)) : checkpointInput({ schemaVersion: 1, key: options.key ?? randomUUID(), type: type ?? "checkpoint", summary: requiredText(options.summary, "--summary or --input"), expectedRevision: requiredText(options.expect, "--expect or --input") });
    if (type) input.type = type;
    const event: TraceEvent = checkpoint(env.root, id, { session: local, input, collected: { baseCommit: gitHead(env.root), verification: "not-run-by-checkpoint" } });
    return { schemaVersion: 1, event, git: autoCommit(env.root, event, { session: local, files: options.files }) };
  }));
}
