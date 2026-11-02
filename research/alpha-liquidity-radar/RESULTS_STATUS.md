# Research results and audit status — 2026-11-02

Decision: no validated statistical edge; do not activate signals or deploy.

## Completed-run aggregates retained in execution output
Run timestamp: 2026-11-02T15:51:20.809Z.
564 discovered USDT pairs: 291 active and 273 delisted.
373 pairs tested, including all 291 active pairs and 82 delisted pairs.
2,782,510 bars; 1,453 eligible pair/timeframe combinations out of 2,256 requested; 509 combinations with 180 days.
94,028 raw early warnings; 109,774 alternative simulated trades across configurations and folds. These are not independent opportunities.

Confirmed-entry temporal holdout, +10% target / -5% stop, 24h, fee 0.1% plus slippage 0.2% each side:

| Frame | Trades | Net-positive win rate | Mean net return per trade | Profit factor |
|---|---:|---:|---:|---:|
| 5m | 687 | 27.80% | -2.060% | 0.441 |
| 15m | 1508 | 34.88% | -0.964% | 0.654 |
| 1h | 1341 | 31.62% | -1.148% | 0.551 |
| 4h | 102 | 24.51% | -1.039% | 0.339 |

1h matched random mean -0.626%; production entry rules with standardized fixed exits -0.439%. This is not a full reproduction of production trailing exits. Enhanced confirmation: 631 trades, 34.07% net-positive, mean -0.763%.
1h early-warning reference: 288 target hits among 4064 simulated trades; conditional warning-to-target mean 12.05h. This does not measure onset of the rise.

## Critical reproducibility limitation
The completed run's detailed result files and ledgers were lost during a workspace interruption before durable saving. Above aggregates were transcribed from actual execution output. The retained checkpoint is older: 598 pair/timeframe files (564 4h and 34 1h). It cannot reproduce the complete aggregate run. Coverage workbook explicitly describes that earlier checkpoint; missing saved files must not be read as untested coins.

No validated best strategy or best timeframe. 5m/15m histories in the run cover only about 5.2/15.6 days. 1333 of 1341 1h confirmed trades failed the diagnostic 200 USDT <= 1% median prior volume capacity condition. Returns are hypothetical, not realizable portfolio profits.

## Remaining work
Restore/recollect full data and rerun with durable ledgers; complete robust walk-forward/regime validation; historical depth, verified taker/CVD and on-chain studies; continuous paper observation; calibrated rankings; reproducible portfolio metrics and per-coin strategy results. Existing chronological split is not a complete optimized walk-forward study. Portfolio exclusions based on future exit liquidity are explicitly optimistic feasibility diagnostics.

## Validation and production boundary
32 tests passed again at final delivery, covering causal prefix invariance, next-open entry, conservative target/stop ambiguity, adverse gaps, fees, overlap, higher-frame availability and offline message formatting.
Research branch only. No production deployment, Telegram sends or secret changes.
