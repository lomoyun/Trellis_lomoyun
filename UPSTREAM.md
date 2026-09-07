# Upstream relationship

This independent fork starts at `88f4834449da9b4f607ec05e322408a0aa66f2ce`
of Trellis (0.6.16). Original history, LICENSE and COPYRIGHT are retained.

Upstream: https://github.com/mindfold-ai/trellis.git

Compare commits after the baseline. Prefer selective, reviewed ports. Record
the upstream commit and its adopted / rewritten / skipped disposition here.
Do not merge workflow, channel or sub-agent machinery automatically.

## Evaluated commits

| Commit | Disposition | Reason |
| --- | --- | --- |
| 88f4834449da9b4f607ec05e322408a0aa66f2ce | Baseline | Trellis 0.6.16 source |

The planned Lite CLI must never fetch upstream. Repository maintenance is a
separate, explicit developer operation. The inherited publishing configuration
has not yet been removed; disabling it is part of the implementation plan.

## Independent repository

The working clone is `E:/projects/Trellis_lite`, separate from the unchanged
source checkout at `E:/projects/Trellis_lomoyun`. Its `origin` is
https://github.com/lomoyun/Trellis_lomoyun.git; `upstream` remains the original
project for explicit maintenance only. The fork retains history rather than
starting an unrelated root commit.
