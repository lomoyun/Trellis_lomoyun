# Lite implementation tracker

Accepted scope: preserve Task / PRD / Plan / per-session Trace, scoped project
knowledge, portable context and handoff. Single main agent; native planning
remains read-only until the host allows writes. No native goal without explicit
user intent. No automated push in the product.

## Delivery steps

- [x] Create independent local Git repository retaining upstream history.
- [x] Configure the personal origin and verify its main branch matches the baseline.
- [x] Implement typed storage, quick/standard tasks, revisions and trace.
- [x] Implement context, session bindings and evidence-based handoff.
- [x] Implement thin platform adapters and scoped auto-commit authorization.
- [x] Implement reversible legacy migration and managed template updates.
- [x] Remove old runtime, templates and publishing workflows from active tree.
- [x] Run final lint, typecheck, tests and packed CLI smoke checks after review fixes.
- [ ] Push verified changes to the explicitly requested personal remote.

## Repository bootstrap delivery

The initial bootstrap commit recorded scope only. Implementation now lives in
packages/core/src and packages/cli/src. The current work includes executable
task, trace, context, session, native-tool advice, migration, template and scoped
commit behavior. Live host verification is separate from local test delivery.

## Contracts

Quick stores metadata, PRD and plan in task.md; standard uses task.json,
prd.md and plan.md. Task IDs and trace paths stay stable across expansion.
Trace is one JSONL file per session, with idempotent checkpoint keys and
document snapshots. Shared files use relative POSIX paths and LF-normalized
content revisions. Local bindings, policies, transaction recovery and backups
are ignored by Git. Native sessions are never a shared identity.

Auto-commit is off until the current user grants records or task scope.
Unrelated staged/dirty changes are never silently included. Checkpoints remain
saved if committing fails. Verification reports distinguish reported and
collected evidence; task completion is separate from verification status.

## Verification

Use isolated repositories, two-clone scenarios, interrupted transaction tests,
dirty-index tests, migration snapshots and built/packed CLI execution.
Real Codex / Claude / Cursor host acceptance must be reported separately from
adapter fixture tests. No full compatibility claim without a live host test.
