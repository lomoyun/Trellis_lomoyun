import { object, requiredText, type JsonObject } from "./model.js";

export interface NativeAdvice {
  schemaVersion: 1;
  readOnly: boolean;
  plan: string;
  goal: string;
  taskCompletion: "explicit-finish-only";
}

/** 只返回宿主适配建议，永远不执行宿主命令或读取对话数据库。 */
export function nativeAdvice(input: JsonObject): NativeAdvice {
  object(input);
  const readOnly = input.mode === "plan" || input.readOnly === true;
  const plan = readOnly ? "Keep planning in the host; do not create tasks, checkpoints, commits or bindings. Import the confirmed plan after write mode resumes."
    : input.confirmedPlan === true ? "Import the confirmed plan verbatim into this task; preserve step IDs and do not replan automatically."
      : "Use the host plan for execution; save only confirmed milestones in the task plan.";
  let goal = "Do not create a native goal without an explicit user request.";
  if (input.goalRequested === true) goal = input.existingGoal ? "Keep the existing native goal; do not replace or reset it. Ask if it belongs to a different task." : "The main agent may create the explicitly requested goal if the host supports it; otherwise use task tracking.";
  if (readOnly) goal = "Read-only: do not create or update native goals.";
  if (input.goalId !== undefined) requiredText(input.goalId, "goalId");
  return { schemaVersion: 1, readOnly, plan, goal, taskCompletion: "explicit-finish-only" };
}
