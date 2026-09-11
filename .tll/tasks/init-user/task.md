---
schemaVersion: 1
id: init-user
title: 初始化时登记本机使用者
creator: lomoyun
owner: lomoyun
status: done
createdAt: 2026-09-08
updatedAt: 2026-09-08T02:41:35.477Z
---
# PRD

Support tll init -u/--user; use Git user.name on first init when omitted.
Store the name under .tll/.local, never shared configuration or Git config.
Repeat init preserves an existing registration; explicit -u changes it.
Task/session default actor order: explicit --actor, selected session, local user,
then Git user.name. No automatic session creation, commit authorization or push.

## Acceptance

- Both flag spellings work; missing/blank identity gives an actionable error.
- Initialization and local registration are in one recoverable transaction.
- Preview/read-only/template conflicts do not write a local user.
- Temporary actors and existing sessions do not change the stored default.
- Local identity is ignored by Git and isolated per project; init keeps 5 shared files.
- Lint/typecheck/tests and installed packed CLI smoke pass.

<!-- tll:plan -->
# Plan

- [x] S1: Inspect contracts, callers and dirty-worktree boundaries.
- [x] S2: Add failing user-registration tests and implement scoped behavior.
- [x] S3: Verify regressions, packed CLI and document usage/evidence.

## Verification (2026-09-08)

- `pnpm check`: exit 0; lint, typecheck, build and 71 tests passed (45 core, 26 CLI).
- `pnpm smoke:pack`: exit 0; isolated packed installation passed, including user
  registration and default task/session actors; 5 shared files retained.
- Global `tll init --help` exposes `-u, --user`; existing link uses this checkout.
- GitNexus scope review includes prior uncommitted namespace migration and reports
  high overall risk; FTS and flow coverage are limited. Source review and tests
  supplement the graph. No commit, push or global installation performed.
