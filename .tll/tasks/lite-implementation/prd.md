# 实现保留追溯核心的 Trellis Lite

## Goal

Keep portable, cross-person Task / PRD / Plan / Trace while removing mandatory
methodology, subagent orchestration and copied Python runtimes.

## Scope

Independent private Node/TypeScript core and CLI packages; explicit task modes,
session-local bindings, bounded context, host-native plan/goal advice, optional
priority-platform hooks, scoped local commit permission, conservative migration
and protected template updates. Preserve upstream Git history and licensing.

## Acceptance

- AC1: Quick and standard tasks round-trip PRD/Plan/extension metadata; explicit
  expansion retains identity, attachments and trace directories.
- AC2: Stale revisions, unsafe paths, competing writes and interrupted
  transactions cannot silently overwrite later user edits; retries are durable.
- AC3: Independent sessions/people have separate trace files and local bindings;
  two-clone Git merge preserves traces and exposes conflicting document edits.
- AC4: Native plan mode has no writes; confirmed plan text imports unchanged;
  native goals require explicit user intent and do not implicitly close tasks.
- AC5: Auto-commit is off without local authorization; records/task scope never
  absorbs pre-existing staged work, initial mixed edits or another task's state.
- AC6: Legacy migration preserves unknown metadata, attachments, archived history
  and custom configuration; ambiguous ownership/conflicting plans are reported.
- AC7: Generic init has at most 5 shared files, each platform at most 4 extra,
  generic templates below 30 KiB, context defaults to 16 KiB with explicit omissions.
- AC8: Lint, typecheck, regression tests and installed packed CLI smoke pass.
  Fixture compatibility is reported separately from live-host/other-OS acceptance.
