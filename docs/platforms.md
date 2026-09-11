# Platform integration boundary

The platform registry retains 22 platform IDs. These are metadata and fallback
instructions, not 22 independently verified integrations. All can consume shared
AGENTS.md / tll context manually. Codex reads AGENTS.md; Claude gets a CLAUDE.md
pointer; Cursor gets a short rule. No generated subagents or process supervisors.

The shared entry leads with main-agent delivery ownership, independent Task scope/
acceptance, mandatory review, non-overlapping parallel writes and truthful evidence.
It distinguishes finished/tests passed/committed/pushed, forbids auto-push and private
reasoning/raw chat/secrets in records, and excludes read-only work from Task lifecycle.

Default to direct execution. Delegate only independent work with a clear net benefit
after dispatch, context transfer and review costs. Native subagents must use model
`gpt-5.6-sol` with reasoning effort `xhigh`. If unavailable or unconfirmable, report
once and continue with the main agent, without substitution. At most two subagents
run concurrently, with no
recursion and stricter host/user limits taking precedence. Extra CLI processes must
not simulate delegation. Dispatch, notifications, waiting and cancellation belong
to the host. TLL adds no scheduler, listener, commands, configuration or custom agent
files; the model choice is an instruction, not a host-setting change or live validation.

The main agent assigns non-overlapping write scopes and a code baseline, then
accepts the actual diff, requirement fit, versioned test evidence and integration
impact. Subagents implement and self-test locally, but do not mutate any TLL state,
commit/push or delegate. Delegation is an existing Task's Plan step;
the main agent records dispatch and acceptance with existing checkpoint/evidence.
Checkpoint performs no checks, and finish has no enforced acceptance gate. These
are instruction-layer responsibilities, not runtime enforcement or proof that a
host has passed live acceptance.

The supplied entry requires Tasks for every repository change, including small edits,
but performs registration/session/binding operations only when needed. Current context,
successful command revisions and adequate Plans are reused. Small uninterrupted Tasks
normally need one final evidence checkpoint, then finish; intermediate records cover
material decisions, scope changes, blockers and recovery-relevant milestones.

Opt-in hooks use a project-local settings entry invoking `tll hook --platform`.
The CLI must already be available on the host PATH, and the host must approve
the hook. No global settings or feature flags are silently changed.

| Host | Config | Event | Output |
| --- | --- | --- | --- |
| Codex | .codex/hooks.json | SessionStart | hookSpecificOutput.additionalContext |
| Claude Code | .claude/settings.json | SessionStart | hookSpecificOutput.additionalContext |
| Cursor | .cursor/hooks.json | sessionStart | additional_context |

Hook adapters read existing native-session mappings but never create one. In
write mode, `session new --native-session` explicitly stores a mapping under
.local/native. Missing binding returns candidates rather than guessing. No raw
chat or native goal database is accessed. Session UUIDs, not native IDs, appear
in shared trace paths.

The shape was checked against the official
[Codex hooks documentation](https://developers.openai.com/codex/hooks),
[Claude Code hooks reference](https://code.claude.com/docs/en/hooks) and
[Cursor hooks documentation](https://cursor.com/docs/hooks) on 2026-09-07.
Fixture tests verify emitted JSON and no writes. They do not prove hook approval,
PATH availability or model-visible injection in a real host. Those remain
separate live-host acceptance items.
