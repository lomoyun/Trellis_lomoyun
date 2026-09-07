# Verification record — 2026-09-07

Environment: Windows / PowerShell, Node 22.20.0, pnpm 10.32.1.
Implementation baseline: bootstrap commit 0efd1c2f, upstream 88f48344.

## Final sequential run

| Check | Result |
| --- | --- |
| pnpm lint | Passed, both packages |
| pnpm typecheck | Passed, core built before CLI declaration resolution |
| pnpm test | Passed: 35 core + 14 CLI = 49 tests in 8 files |
| pnpm smoke:pack | Passed: built tarballs installed and exercised in a separate project |
| Built CLI update --dry-run in this repository | No changes, conflicts or warnings |
| git diff --check / cached --check | Passed before delivery staging |
| Source repository | Unchanged at 88f48344; clean worktree |

Tests include task/PRD/Plan round trips, extension fields, expansion conflicts,
stale revisions, recovery conflicts, symlink/path defenses, reordered JSON
idempotency, independent-process sequence allocation, native read-only guards,
reported-vs-collected evidence, legacy migration, custom hook preservation,
template block protection, scoped commits and commit-hook failure/retry.

The two-clone Git test merged independent session traces, proved local bindings
were not shared, and intentionally produced a PRD merge conflict on competing
edits. These local fixture remotes do not contact GitHub.

## Distribution and footprint

- Two private packages: @trellis-lite/core and @trellis-lite/cli, version 0.1.0.
- 20 runtime TypeScript files / 1,292 physical lines (excluding tests/docs/build).
- Generic initialization: 5 shared files; regression cap 30 KiB of generic text.
- Each priority platform: at most 4 extra files; no generated subagents/Python.
- Tarballs: 47 core files, 40 CLI files including declarations/maps and licensing.
- Smoke installation uses a local core-tarball override because the package is
  private and not published. Runtime dependencies may use npm metadata/cache;
  this is not a claim of a fully offline first installation.

## Review fixes verified

- Mixed hook groups retain their custom commands.
- User-edited managed Markdown blocks cause a conflict rather than overwrite.
- Task identity must match its stable directory.
- Reordered JSON fields do not create an idempotency conflict.
- The explicit task ID overrides a stale/missing local session binding.
- Other legacy host integrations block automatic runtime deletion until manually
  detached, preventing removal of their still-needed shared scripts.
- Windows test cleanup uses asynchronous removal so child-process resources can
  close before temporary directories are removed.

## Limits — not claimed as verified

- Actual host hook approval, PATH discovery and model-visible context injection
  in Codex / Claude / Cursor. Hook JSON fixtures are not live-host acceptance.
- Native goal tool execution. The product exposes advice; the main agent invokes
  a supported host tool only after explicit user intent.
- macOS/Linux execution and Node 20 execution. Those remain release-matrix checks.
- Automatic migration of every historical host-specific configuration. Unknown
  or modified integrations require manual detachment; originals are preserved.
- Detecting the true author of edits to a shared code file after attribution.
  Such files should use manual commits.

GitNexus source indexes were refreshed for review. Its FTS extension is unavailable
on this Windows installation and process enumeration reports limited coverage.
The graph is supplementary impact evidence, not a complete safety certificate;
the implementation was also inspected directly and tested end to end.
