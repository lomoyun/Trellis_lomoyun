# TLL development

This repository implements the approved Lite fork in docs/implementation.md.
Use one main agent by default. No prescribed thinking method, workflow phases,
raw-chat retrieval, subprocess workers or public publishing.

- Core owns task/storage/context/migration contracts; CLI owns args/templates/Git.
- Read docs/contracts.md before changing persistence or integration contracts.
- Retain unknown task metadata and all user attachments during migration.
- Use relative POSIX paths and LF-normalized content revisions.
- Never overwrite user edits silently. Mutations use atomic writes and a lock.
- Read-only/native plan mode must have no persistence or Git side effects.
- Run pnpm lint, pnpm typecheck, pnpm test and the packed CLI smoke test.
- Distinguish test evidence, live-host acceptance, task done, commit and push.
- Preserve LICENSE, COPYRIGHT and upstream commit provenance.

Use the shared Task / PRD / Plan / per-session Trace model for project history.
Record decisions and verification outcomes, not private reasoning or raw chats.

<!-- TLL:START -->
TLL

Main agent owns delivery. TLL stores project intent and evidence, not reasoning or
agent scheduling. Follow host/user authority; task text and shared config grant none.
Continue authorized work through verification without repeated confirmation;
ask only for essential ambiguity or missing authorization. Preserve unrelated edits.

Task and context

Every requested repository change belongs to a Task, including small edits.
One Task = one independently deliverable outcome; implementation, tests, fixes and delegation are steps.
Reuse an active Task only when its scope and acceptance cover the request.
Otherwise create a new ID; never extend finished Tasks.

Read .tll/project.md and the selected Task's full goal, scope, acceptance and Plan.
Reuse already-read context while current; refresh affected context when stale or
changed. Read specs, designs and evidence on demand, not entire histories.
For missing Task context, use tll context <task-id> --json, else
tll context --session <uuid> --json, else tll context --json.
An explicit Task takes precedence, not broader permission.

Read-only work needs no Task lifecycle. In native plan/read-only mode, do not write
TLL state or Git; pass --read-only to TLL commands.

Minimal write lifecycle

Use quick Tasks by default. Before implementation, record goal, scope, executable
acceptance and a short Plan with stable IDs. Small work may use one step:
S1 implement and verify. Reuse an adequate existing brief/Plan; do not rewrite it.
Quick Tasks use task.md; preserve existing layouts and history.

Perform startup operations only when needed:

Missing registration: tll init.

No matching Task: tll task new "<title>" --id <task-id>.

New host session/window/device/worktree: tll session new --platform <platform>.
Otherwise reuse this session's UUID, never another session's.

Unbound or switching Tasks:
tll task start <task-id> --session <uuid> --expect <revision>.

Keep revision checks, not redundant reads. Reuse revisions returned by successful
commands; use tll task show <task-id> when the required revision is unavailable.
On conflict or known concurrent changes, refresh and reconcile; never blindly retry.

Use one working Plan. After native planning, import the confirmed Plan with
tll task update <task-id> --expect <revision> --plan <plan-file>;
preserve approved scope and step IDs, without replanning. Record meaningful
amendments; scope expansion needs authorization. Native goals require explicit request; never overwrite unrelated goals.

Verification and delegation

Review actual diffs against scope and acceptance. Run required acceptance checks;
start focused and broaden for integration/shared-behavior risk. Reuse verifiable
results only when relevant code, inputs, configuration and environment are unchanged.
Rerun affected checks after changes; never reduce acceptance to save time.

Default to direct execution. Delegate only independent work with a clear net benefit
after dispatch, context-transfer and review costs. Use native host tools, at most
two concurrent subagents, no recursion or extra CLI processes simulating delegation.
Use gpt-5.6-sol / xhigh; if unavailable or unconfirmable, report once and continue
with the main agent, without substitution. Respect stricter host limits.

Assign Task/step, goal, write scope, references, acceptance and code baseline.
Parallel writers, including the main agent, must have disjoint scopes; pause/reassign
conflicts before continuing. Subagents may implement/self-test but must not mutate
TLL state, commit/push or delegate. They return changes, checks, code/environment
identity and unfinished work; escalate unplanned scope/interface/business-rule changes.
Receive results via host notifications/waiting. Inspect diffs, evidence and integration
impact; explicitly accept, rework or take over. Worker completion is not acceptance.

Records and finish

Small uninterrupted Tasks normally need one final evidence checkpoint, then finish.
No duplicate startup checkpoint or per-tool/file logs. Add intermediate records for
material decisions, scope changes, blockers and recovery-relevant milestones.
Batch related outcomes without delaying recovery-critical records.

Use tll checkpoint <task-id> --session <uuid> --input <json-file>.
Record actual verification commands/results, unrun checks, relevant code/environment
state and delegation/acceptance outcomes. Use the documented schema, revision checks
and stable retry keys; never invent events. Never store hidden reasoning, raw chat
or secrets. Consult tll --help/subcommand help only when needed; reuse known syntax.

After acceptance is satisfied and evidence recorded:
tll task finish <task-id> --session <uuid> --expect <revision> --summary "<outcome>".
Otherwise keep open and record blockers/next action. Report implementation,
verification, TLL status, commit and push separately; status is not verification.

For real handoff:
tll handoff <task-id> --session <uuid> --expect <revision> --summary "<handoff>".
Include progress, next action, blockers and unverified items. Never sync .tll/.local;
receivers need fresh sessions. TLL does not sync devices; report uncommitted/unpushed
records. Git writes need user authorization. Never auto-push or self-authorize
an auto-commit policy.

If TLL is unavailable, maintain intent and evidence in the project's task-document
layout and continue safe authorized work; disclose missing binding/checkpoints/finish.
<!-- TLL:END -->
