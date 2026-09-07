# Platform integration boundary

The platform registry retains 22 platform IDs. These are metadata and fallback
instructions, not 22 independently verified integrations. All can consume shared
AGENTS.md / tll context manually. Codex reads AGENTS.md; Claude gets a CLAUDE.md
pointer; Cursor gets a short rule. No generated subagents or process supervisors.

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
