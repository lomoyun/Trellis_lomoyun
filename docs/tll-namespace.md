# TLL namespace change — 2026-09-07

## Scope and decisions

User-facing command: tll only. Project state: .tll only. Generated managed blocks
use TLL markers, and Cursor uses .cursor/rules/tll.mdc. Internal private npm package
names, upstream licensing and historical records retain their provenance names.
No global installation, commit, push or migration of other business repositories
was performed in this change.

Read-only preview and explicit apply are separate. Stop old agents before directory
migration. Existing .tll, links, old locks and unfinished transactions are refused.
Directory rename preserves bytes; it is followed by content migration and init.
The directory move is not part of a recoverable content transaction. Later content
transactions still support conservative recovery. Existing .trellis transaction
logs cannot replay old paths after migration. Pre-TLL commit grants stay inactive.
Old Lite managed blocks require ownership hashes to upgrade; custom text survives.

Current task revisions change with the new paths. Historical Trace snapshot paths
and revisions are not rewritten; read current tasks again and use new checkpoint
keys. Existing Lite local session files remain local. New windows/devices need new
session IDs. External scripts referring to old paths need manual updates.

## Verification

- TDD: new namespace test initially failed because init still created .trellis.
- Final sequential pnpm check: lint/typecheck/build passed; 42 core + 19 CLI =
  61 tests passed in 9 files, on Windows (2026-09-07, tests started 16:48 local).
- pnpm smoke:pack: passed; separate installed project has exactly 5 shared files
  under the new layout; core tarball 51 files and CLI tarball 40 files.
- Added cases cover binary/Trace preservation, collision refusal, old locks,
  pending transactions, junction refusal, old manifest paths, old transaction
  replay refusal, custom config/blocks/rules, read-only migration and old grants.
- Dogfood migration: six task/workspace files had identical SHA-256 hashes across
  the directory rename. This includes the completed implementation task and trace.
- Dogfood init/update: old managed entry upgraded; subsequent update --dry-run
  returned no changes/conflicts/warnings. Policy remained null.
- Original E:/projects/Trellis_lomoyun remains clean at 88f48344.

Development/check skills kept migration contracts, preservation checks and quality
gates in scope. GitNexus impact reports identified shared task/lock/transaction/Git
paths as HIGH risk. Its FTS and flow enumeration remain incomplete; graph results
are supplementary to direct review and executable tests, not a safety certificate.
Actual host hooks and macOS/Linux execution remain unverified.
