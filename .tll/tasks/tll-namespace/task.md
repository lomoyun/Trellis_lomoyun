---
schemaVersion: 1
id: tll-namespace
title: 将项目管理目录和入口统一为 TLL
creator: lomoyun
owner: lomoyun
status: done
createdAt: 2026-09-07
updatedAt: 2026-09-07T08:51:11.953Z
---
# PRD

Goal: use tll and .tll in managed projects instead of Trellis naming.
Scope: core persistence, CLI templates, explicit directory migration, tests and docs.
Do not modify other business repositories, upstream licensing or historical traces.

## Acceptance

- Fresh init creates .tll only, with TLL guidance and tll platform rule names.
- Task/PRD/Plan/Trace, sessions, context and scoped commits use .tll.
- Explicit old-directory rename preserves bytes, rejects collisions/locks/pending transactions.
- Old authorization is not inherited; old trace snapshots are not rewritten.
- Existing Lite managed entries upgrade without duplicating or overwriting custom blocks.
- Lint, typecheck, full tests and packed installation smoke pass.

<!-- tll:plan -->
# Plan

- [x] S1: Inspect shared path contracts and impact; add a failing namespace test.
- [x] S2: Switch active paths/branding and add explicit conservative directory migration.
- [x] S3: Verify migration, regressions, packed CLI and this repository's own records.
