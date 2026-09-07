# Lite executable contracts

## Boundaries

Core is TypeScript/Node domain logic with no terminal, host-agent tools, network,
Git subprocesses or CLI argument parsing. CLI imports its public package root.
Only the Git wrapper launches a product subprocess. Tests may use isolated Git
remotes and child Node processes. No public npm publishing is configured.

Generic init produces five shared files: AGENTS.md, .trellis/config.yaml,
project.md, .gitignore and .lite-templates.json. Local transactions are excluded
from the shared-file budget. Platform guidance points to AGENTS.md rather than
duplicating the workflow. Hooks are opt-in and read-only.

## Task and document versions

- Task statuses: draft, doing, blocked, done, cancelled. They do not imply tests.
- Quick: YAML frontmatter plus PRD and Plan separated by <!-- tll:plan -->.
- Standard: task.json, prd.md and plan.md in the same stable directory.
- Unknown metadata survives writes. Identity/creator/creation time are immutable.
- Explicit expand only. Reject competing formats and existing expansion targets.
- Document revision is SHA-256 over sorted relative paths and LF-normalized text.
- Update/expand/checkpoint require an expected revision. A stale writer fails.
- User Markdown is not parsed into a second plan schema; step IDs are preserved.

## Trace

One JSONL file per locally generated session UUID. Sequence is local to that
file, not project-wide. A checkpoint records event UUID, stable retry key, UTC
time, human actor separately from platform/agent, document revision and full
document snapshots. Same-key different requests fail. Snapshot history begins
at an explicit checkpoint; this is not a transcript or keystroke recorder.

CLI checkpoints collect the existing Git HEAD, not a future/self-referencing
commit hash. User evidence remains reported evidence. Checkpoint never runs or
invents verification. Native-goal events do not close tasks. Finish does so
explicitly and writes its state and event together.

## Storage and concurrency

Files are UTF-8. Cross-device paths use POSIX separators; absolute/escaping paths,
Git internals and symlink components are refused. State uses same-directory
temporary files, fsync, then rename. A project-local exclusive lock serializes
cooperating writers. No time-based stealing of a possibly live lock.

A transaction persists exact before/after text before applying changes. Recovery
can resume or roll back only while every file matches one of those states; later
edits cause a conflict instead of data loss. A failed write names the transaction.
Readers can encounter an incomplete multi-file transaction and must recover it;
atomic file replacement does not make arbitrary external editors transactional.

Local state is ignored by Git and is operational state, not an authentication
boundary against another process with the same filesystem privileges. New
devices/windows/worktrees create new UUIDs and bind the shared Task ID explicitly.

## Context and native tools

Selection: explicit ID, then local session binding, otherwise candidates only.
Read paths never create local state. Default budget is 16 KiB of compact JSON;
the shared YAML contextBudget or explicit --budget can change it. Optional specs
require explicit paths. Oversized documents are omitted in full with path/hash,
not silently truncated through acceptance criteria. References alone may exceed
a tiny budget, in which case the command reports an error.

Native plan mode is authoritative. Shared guidance and --read-only/TLL_READ_ONLY
prevent CLI persistence when supplied. Hooks never write regardless of mode.
The main agent imports confirmed Plan text when writes resume. Native goals are
invoked by the main agent only with explicit intent and host capability, never
by a subprocess pretending to execute a slash command.

## Git

Shared settings never grant permission. Policy is keyed by local Git identity,
with records/task scope and session/task/repo-user duration. The grant requires
human consent. An agent must not self-authorize.

Only checkpoint/handoff/finish may attempt a commit. Existing staged changes,
merge conflicts, stale task snapshots or ambiguous code attribution cause a
skip while keeping records. Code files require explicit start-time attribution
and explicit checkpoint-time selection. Initially dirty files are ineligible.
This cannot determine who edited the same file after start; shared editing
requires manual commit. No git add ., force-add, auto-push or arbitrary shell.

Normal Git hooks run. A failed commit leaves a local retry receipt plus its
staged files. Retry is allowed only when the index and file bytes match that
receipt; unrelated staged work still prevents commit.

## Migration and updates

Dry-run does not create a lock, backup, binding or transaction. Legacy tasks are
read-only until converted. Active legacy tasks retain directory IDs, metadata,
original record provenance, PRD, implement.md and attachments. Archives remain
readable. Divergent existing plan.md causes a preflight conflict.

Old config is backed up under history; permissions and native bindings are not
inherited. Known hook commands are removed individually, preserving custom
siblings. Only manifest-hash-matching old runtime files are deleted; modified
or ambiguous entries block migration or are reported for manual cleanup.
The same template planner serves init and update. User-modified templates are
not overwritten; user content outside managed Markdown blocks is preserved.

Automatic legacy detachment covers the priority hook shapes and the Pi extension;
manifest-owned Claude/Codex/Cursor/OpenCode/Pi/OMP/shared runtime files are handled.
Other platform integrations require manual detachment and block apply while their
manifest-owned runtime entries remain. A platform registry entry is not a promise
of automatic migration for every historical host configuration.
