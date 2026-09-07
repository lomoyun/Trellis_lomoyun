# Trellis Lite

Portable Task / PRD / Plan / per-session Trace for coding agents.
Single main-agent workflow; no mandatory reasoning method or subagent runtime.

Core: packages/core/src (storage, task, trace, session, context, migration).
CLI: packages/cli/src (commands, Git policy, templates, host adapters).
Contracts: docs/contracts.md. Implementation: docs/implementation.md.

Verify with pnpm check, then pnpm smoke:pack. Do not run two builds concurrently.
Use pnpm tll --help for the local CLI. Human approval is required for auto-commit;
product code never pushes. Live-host validation must be reported separately.
