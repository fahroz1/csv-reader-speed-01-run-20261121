# csv-reader-speed-01 — fast CSV reader

A fast drop-in for csv-reader 1.0.0: reads broken CSV files with the
exact same answers as the reference, faster. Bulk delimiter scans
(sticky regexes / indexOf) and `slice()` / `split()` instead of one
character at a time; a record with no quoted field and no stray CR is
split in one native call.

[![csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/fahroz1/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/fahroz1/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

Built for the [csv-reader-speed-01-run-20261121 bounty on make.fun](https://make.fun/bounty/csv-reader-speed-01-run-20261121).

## Run

`node main.ts` (Node 22, standard library only). It reads every case
from `/input/cases.json` (or `$MAKEFUN_INPUT_DIR`), answers each one
alone with `run()` from `solve.js`, and writes `/output/answers.json`
(or `$MAKEFUN_OUTPUT_DIR`).

## Speed (practice set, 6 cases, ~10.6 MB)

| | run() over all 6 cases |
|---|---|
| house baseline csv-reader 1.0.0 | ~528 ms (median of 7) |
| this entry | ~195 ms (median of 7) |

About 2.7x faster, with identical answers on all 6 practice cases
(verified against the kit's own scorer: 6/6 passed).

## Files

- `solve.js` — the fast reader (`run(input)` returns `{columns, rows, errors}`)
- `main.ts` — the entry driver
- `LICENSE` — MIT
