# Lite executable contracts

## Boundaries

Core is TypeScript/Node domain logic with no terminal, host-agent tools, network,
Git subprocesses or CLI argument parsing. CLI imports its public package root.
Only the Git wrapper launches a product subprocess. Tests may use isolated Git
remotes and child Node processes. No public npm publishing is configured.

Generic init produces five shared files: AGENTS.md, .tll/config.yaml,
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
- One Task represents one independently deliverable outcome. Default PRD scaffolds
  ask for goal, in/out scope, observable acceptance and linked references. Reuse
  requires the same scope/acceptance, not merely the same project/module/session.
  New deliverables use new IDs; implementation/testing fixes for the same acceptance
  remain Plan steps. This semantic boundary is agent guidance, not a schema validator.
  Existing documents and supplied PRD/Plan text are never rewritten to fit a scaffold.

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

The default AGENTS entry is a lightweight usage protocol, shared with read-only
hook output. Read-only questions do not require tasks/sessions. Authorized changes
reuse a task only within its existing scope/acceptance, or create a quick task when
the deliverable differs; ambiguous boundaries require clarification. Session-bound context uses
an explicit UUID. Native plan import preserves text and step IDs; later justified
amendments record their reason and respect scope approval. These are agent guidance,
not automatic runtime enforcement. Shared records synchronize through authorized
project Git operations, never by copying .tll/.local. Handoff reports pending sync.

Selection: explicit ID, then local session binding, otherwise active candidates only
(draft/doing/blocked). Closed tasks remain accessible by explicit ID or task list.
Read paths never create local state. Default budget is 16 KiB of compact JSON;
the shared YAML contextBudget or explicit --budget can change it. Under pressure,
reserve all references, then pack complete content by priority: project, task files,
explicit specs, trace summaries. Skip oversized content without evicting later small
items. Optional specs require explicit paths; task attachments and other tasks'
bodies are not auto-loaded. Oversized documents are omitted in full with path/hash,
not silently truncated through acceptance criteria. References alone may exceed a
tiny budget, in which case the command reports an error. JSON escaping and UTF-8
bytes count toward the budget; it is not a token count or a limit on the hook preamble.

Context warns when combined PRD/Plan text exceeds 8 KiB, independent of output
budget. This is advisory, not a size rejection or proof of multiple deliverables.
Keep briefs concise; link designs/logs and related IDs without copying history.
No automatic split, attachment move or historical trace rewrite is performed.

Latest checkpoint and handoff per session remain discoverable. Their context content
is a projection of id/task/session/seq/at/type/actor/revision/summary, not a complete
TraceEvent. Evidence, snapshots and collected payloads remain in the referenced
JSONL event; a warning explains this. No cross-session causal order is inferred.
Read the selected task's complete goal/scope/acceptance/Plan before implementation;
read historical evidence and attachments only when relevant.

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

Old config is backed up under history; pre-TLL commit grants are not inherited.
Existing Lite local sessions remain local; new windows/devices create new sessions.
Known hook commands are removed individually, preserving custom
siblings. Only manifest-hash-matching old runtime files are deleted; modified
or ambiguous entries block migration or are reported for manual cleanup.
The same template planner serves init and update. User-modified templates are
not overwritten; user content outside managed Markdown blocks is preserved.

Automatic legacy detachment covers the priority hook shapes and the Pi extension;
manifest-owned Claude/Codex/Cursor/OpenCode/Pi/OMP/shared runtime files are handled.
Other platform integrations require manual detachment and block apply while their
manifest-owned runtime entries remain. A platform registry entry is not a promise
of automatic migration for every historical host configuration.

## TLL project namespace

All current records, context, locks, policies, transactions and handoffs live in
.tll. Project entry markers use TLL:START/END and Cursor uses rules/tll.mdc.
The only public binary is tll; internal private package names remain unchanged.

Directory migration is an explicit separate command: migrate --rename-directory.
Without --apply it is read-only. Stop all old writers first; existing destination,
links, old locks and unfinished transactions are refused. A same-parent directory
rename preserves all file bytes, including binary assets and historical snapshots.
Then run migrate to convert legacy formats/config/hooks, and init to update entry
templates. Those later stages remain transactional; the directory rename is not
part of a content transaction and is not reversed by recover --rollback.

Historical snapshot paths/revisions keep their original namespace. Fresh reads
compute current .tll revisions. Old transaction logs cannot replay .trellis paths.
Pre-TLL authorization files lack product: tll and therefore cannot grant commits.
Old Lite managed blocks upgrade only with matching manifest hashes; customized
blocks/rules conflict instead of being overwritten or duplicated.

## Local user registration

CLI init accepts -u/--user. First initialization falls back to Git user.name;
subsequent init preserves the registered name unless -u is explicit. A missing
or blank name fails before initialization with an actionable error. update does
not register or change a user. Global --actor is a temporary task/session override,
not an alternative registration option for init.

The UTF-8 .tll/.local/user.json stores schemaVersion: 1 and name. Core validates
and serializes it; CLI resolves Git fallback. Registration joins the same locked,
recoverable transaction as template changes, outside the shared template manifest.
Dry-run/native read-only modes cannot persist it. Names do not grant permissions,
change Git config, create sessions or rewrite existing actor/trace history.

Actor precedence for new tasks/sessions: explicit --actor, selected session,
registered project-local name, Git user.name. Invalid stored names fail closed;
an explicit init -u can repair registration. Existing sessions retain their actor.
