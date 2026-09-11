# Verification record — 2026-09-07

Environment: Windows / PowerShell, Node 22.20.0, pnpm 10.32.1.
This is the original Lite delivery record. The later .tll namespace change is
recorded separately in [tll-namespace.md](tll-namespace.md).
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

## Delivery

Implementation commit: 21267235682551fcae0b44ec15ed1f2168967540.
Pushed to the requested personal origin main; confirmed by git ls-remote.
The final staged graph check reported CRITICAL for the whole-runtime replacement:
461 changed indexed symbols and 20 affected indexed processes. This is not a
low-risk patch or a complete enumeration of removed upstream files. The local
session/policy/transaction state is excluded from Git; licensing copies match.
Task completion and handoff are recorded in a following documentation-only commit.

## Simple delegation guidance — 2026-09-11

Task: [simple-subagent-delegation](../.tll/tasks/simple-subagent-delegation/task.md).
This instruction-only change extends the shared ENTRY consumed by init/update and
existing read-only hooks. It adds no scheduler, event/schema, command, configuration
or runtime acceptance gate. Earlier delivery records above retain their original scope.

Software regression on Windows, Node 22.20.0 / repository pnpm 10.32.1:

| Check | Result |
| --- | --- |
| pnpm lint | Passed, both packages |
| pnpm typecheck | Passed; initial sandbox child-process EPERM resolved by an approved run outside the sandbox |
| pnpm test | Passed: 56 core + 34 CLI = 90 tests in 14 files |
| pnpm smoke:pack | Passed after the same sandbox process restriction was resolved; installed packages generate delegation rules, 5 shared files, core 55 / CLI 40 packed files |
| Entry/update regression | Fresh entry, hash-matching old block upgrade, outside text preservation, modified delegation-rule conflict, idempotency |
| Hook regression | All three existing adapters return the same ENTRY; initialized local/shared file bytes stay unchanged, and empty-root hooks create no files |
| Repository update | Preview changed only AGENTS.md and .tll/.lite-templates.json. After the user released Zed's file lock, transaction 1d16c140-5564-464a-aa05-d5272790de68 recovered to applied; outside-block content was unchanged, manifest hash matched, repeated update changed nothing, and dry-run returned no changes/conflicts/warnings |

Live-host acceptance used one native Codex subagent in an isolated temporary
project initialized by the newly built CLI. The main agent supplied Task/step,
goal, sole writable file, references, executable acceptance and SHA-256 baselines.
The subagent read the generated AGENTS.md, implemented summarizeChecks and ran
`node --test acceptance.test.mjs`: exit 0, 6 passed, no skips. The main agent
received its native notification, read the actual implementation and tests, and
compared both fixture and repository TLL snapshots. Only the assigned source file
changed among 9 fixture files; all 59 repository TLL files stayed unchanged during
delegation. No child Task, session or Trace was created by the subagent.

Main-agent verdict: **pass**. The unchanged test/source hashes and Node executable
version support reusing the reported test evidence; no duplicate run was needed.
Tested source SHA-256: F1F3F89ACF450FAF234F98F5D4BE79C2E6FCC4AFC227CB967C13FC6B5F51114A.
Acceptance file SHA-256: 2B2FCBDC7D8CAED7166C9B65B3E43FEFFBC47FEB50C0CCDB8AF6C6D9A90D3A55.
The temporary directory resolves pnpm 10.33.0; this was reported and does not affect
the Node-only sample. The source, tests and version evidence are preserved in the
task's existing verify checkpoint, separately from software regression evidence.

This proves one actual dispatch/notification/review cycle in the current Codex host.
Other hosts, live hook approval/injection, concurrent subagents, cancellation and
rework paths were not exercised. They are not claimed as accepted. Repository task
completion, Git commit and push remain separate from both kinds of test evidence.

The repository refresh was verified after recovery without changing the four
previously tested source/test/script hashes or Node/pnpm versions; the sequential
software regression evidence remains applicable. Unrelated pre-existing worktree
files were checked against the pre-task snapshot and preserved. The main agent
records final acceptance and finishes the Task; no Git commit or push was performed.

## Core entry rules and subagent model — 2026-09-11

Task: [agent-entry-core-rules](../.tll/tasks/agent-entry-core-rules/task.md).
The shared entry now leads with delivery ownership, Task scope/acceptance, delegated
review, non-overlapping writes, truthful evidence, the four separate delivery states,
no auto-push, private-data exclusion and the read-only lifecycle boundary. It retains
the necessary TLL commands and specifies `gpt-5.6-sol` with reasoning effort `xhigh`.
If unavailable, the main agent reports that limitation and does the work; no silent
model/effort substitution. No runtime, schema, CLI options or host settings changed.

| Check | Result |
| --- | --- |
| pnpm lint / pnpm typecheck | Passed sequentially on the final changes |
| pnpm test | Passed: 56 core + 34 CLI = 90 tests; obsolete conflict-fixture text was corrected after the first run |
| pnpm smoke:pack | Passed; installed CLI includes core rules and exact model/effort; 5 shared files, core 55 / CLI 40 packed files |
| Entry safety | Old managed block upgrades safely; user-edited model conflicts preserve all file bytes; all existing hooks reuse the entry read-only |
| Repository update | Only AGENTS.md and template manifest changed; outside-block content and unrelated pre-existing files preserved; manifest hash matched; repeated update and dry-run returned no changes/conflicts/warnings |

Environment: Windows, Node 22.20.0, pnpm 10.32.1. No subagent was called in this
revision. Model selection is verified as generated guidance; the earlier live-host
sample does not establish acceptance of this newly specified model/effort combination.
Actual checks, the first-run fixture failure and final outcomes are recorded in Trace.
No Git commit or push was performed.

## Supplied minimal lifecycle entry — 2026-09-11

Task: [agent-entry-minimal-lifecycle](../.tll/tasks/agent-entry-minimal-lifecycle/task.md).
The shared ENTRY now matches the user's supplied 100-line body verbatim, including
`Use gpt-5.6-sol / xhigh` and the unavailable/unconfirmable, report-once, main-agent
fallback rule. The source outside ENTRY is unchanged. Startup runs only when needed,
current context/revisions/Plans are reused, execution defaults to the main agent,
and small uninterrupted Tasks normally record one final evidence checkpoint then finish.

Final sequential validation on Windows, Node 22.20.0 / pnpm 10.32.1:

| Check | Result |
| --- | --- |
| pnpm lint / pnpm typecheck | Passed |
| pnpm test | Passed: 56 core + 34 CLI = 90 tests in 14 files |
| pnpm smoke:pack | Passed: generated policy/model text present; 5 shared files, core 55 / CLI 40 packed files |
| Entry safety and hooks | Previous-block upgrade, model-edit conflict protection, idempotency and all three existing read-only hook adapters passed |
| Repository update | Only AGENTS.md and template manifest updated; generated body equals supplied text, outside-block content/unrelated files preserved, manifest hash matched, repeat update and dry-run empty |

One final evidence checkpoint and finish record this Task. No subagent was called;
the model/effort is verified as generated guidance, not actual host-model execution.
Runtime, persistence schema, commands and host/global settings were not changed.
No Git commit or push was performed.
