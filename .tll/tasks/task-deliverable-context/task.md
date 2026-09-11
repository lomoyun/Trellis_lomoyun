---
schemaVersion: 1
id: task-deliverable-context
title: 按独立交付目标组织任务并控制默认上下文
creator: lomoyun
owner: lomoyun
status: done
createdAt: 2026-09-09
updatedAt: 2026-09-09T08:24:08.991Z
---
# PRD

## Goal

Make the lightweight task workflow keep one independently deliverable outcome per
task, with useful bounded context even when existing task documents are oversized.

## Scope

Change default task/AGENTS guidance and context projection/budget allocation.
No storage schema, dependency, subagent system, automatic task splitting, history
rewrites, external project writes, commits or pushes. Semantic deliverability is
an agent responsibility, not something a byte limit can prove.

## Acceptance

- Scope/acceptance define reuse; new deliverables get separate stable Task IDs.
- Default context candidates exclude done/cancelled; explicit historical reads work.
- Oversized task briefs produce an advisory without modifying or rejecting records.
- A large document cannot evict unrelated small project/spec/trace context.
- Current project/task docs take priority over history; trace evidence is on demand.
- Full acceptance text is included or explicitly omitted with its revision, never
  silently summarized or truncated; existing revision/concurrency behavior is intact.
- Unit/CLI/hook tests and packed installation pass, including read-only checks.

<!-- tll:plan -->
# Plan

- [x] S1: Inspect contracts, reproduction and affected consumers.
- [x] S2: Add failing tests and implement scoped context/task guidance changes.
- [x] S3: Verify, update generated entry and record evidence.

## Verification (2026-09-09)

- TDD: five expected failures reproduced inactive candidates, budget eviction,
  oversized evidence injection and missing deliverable guidance; all fixed.
- `pnpm check`: exit 0; lint, typecheck, build and 88 tests (56 core, 32 CLI).
- `pnpm smoke:pack`: exit 0; private packed installation, new PRD guidance and
  closed-task candidate behavior verified; 5 shared files retained.
- Read-only check of dsh_mche_agent/mche-single-row: 25,661-byte task document
  remained referenced; project content and four session summaries were included.
  Advisory size/evidence warnings appeared. No application files were modified.
- Local template update encountered EPERM during atomic AGENTS replacement.
  Applied the exact planned AGENTS content with apply_patch, compared it byte-for-byte
  with transaction 12f2b634-4791-4cb7-9ea2-bb7c495b3249, and resumed recovery to applied.
  No permission changes or process termination. Final update dry-run had no changes
  or conflicts; git diff --check passed.
- No live-host or non-Windows acceptance claimed. No commit, push, dependency/schema
  changes, automatic split or historical rewrite performed.
