---
schemaVersion: 1
id: default-agent-entry
title: 更新默认生成的 AGENTS 轻量协作规则
creator: lomoyun
owner: lomoyun
status: done
createdAt: 2026-09-09
updatedAt: 2026-09-09T04:54:17.114Z
---
# PRD

Update the default TLL AGENTS entry to close the four reviewed guidance gaps:
task creation, explicit session context, shared Git handoff and plan amendments.
Keep one main agent and native planning. Do not add runtime behavior, dependencies,
schemas, automatic synchronization or permission grants.

## Acceptance

- Read-only questions need no task; authorized implementation reuses a relevant
  task or creates a quick task with goal, scope, acceptance and stable steps.
- Commands include task/session IDs and expected revisions where required.
- Native plan import preserves confirmed text but later justified changes may
  amend the plan with a recorded reason; native goals never implicitly finish tasks.
- Handoffs explain shared records versus local state and unsynchronized changes.
- Fresh init, managed-block update and read-only hook output share the same entry.
- Updates preserve custom content and refuse modified managed blocks.
- Project checks and packed installation smoke pass; no commit or push.

<!-- tll:plan -->
# Plan

- [x] S1: Inspect current contracts, entry consumers and existing changes.
- [x] S2: Add regression tests and replace the default entry.
- [x] S3: Verify, regenerate the repository entry and record evidence.

## Verification (2026-09-09)

- TDD: the new guidance assertion failed against the previous entry, then passed
  after replacement. All 10 targeted entry/template tests passed.
- `pnpm check`: exit 0; lint, typecheck, build and 76 tests (45 core, 31 CLI).
- `pnpm smoke:pack`: exit 0; isolated packed installation passed, 5 shared files.
- `tll update`: regenerated AGENTS.md and its manifest; subsequent dry-run had no
  changes or conflicts. Existing global CLI junction points to this checkout.
- `git diff --check`: exit 0. Existing namespace/user changes were preserved.
- Hook tests verify output and read-only behavior, not live host acceptance.
- No dependency, schema, global install, commit or push changes.
