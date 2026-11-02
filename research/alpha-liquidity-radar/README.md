# GAAFARYPTO V2 — Alpha Liquidity Radar (research only)

This directory is isolated from the production Cloudflare Worker. No deployment or Telegram signal delivery is performed.

## Hypotheses
1. Abnormal quote-volume relative to a trailing, past-only baseline may precede price expansion.
2. Low pre-breakout realized volatility plus rising turnover may improve early warning.
3. Confirmed breakout on closed candles may improve precision but reduce lead time.

## Data contract
Use Binance Alpha exchange info to map symbols, chain and contract identities. Preserve delistings, timestamps and missing data. Closed OHLCV candles alone do NOT identify net inflows, whales, taker buy/sell imbalance or historical order-book liquidity. Use aggressor-side trade data for signed flow only if verified and archive live depth snapshots for future tests.

## Experiment protocol
- Universe: all discoverable USDT Alpha pairs; report actual data coverage and exclusions.
- Frames: 5m, 15m, 1h, 4h; 90-180 days when available, otherwise state actual coverage.
- Warning: past-only relative quote volume, compression and relative strength, with threshold sweeps restricted to training periods.
- Confirmation: closed-bar breakout and persistence; no same-candle fills.
- Labels: forward +10% before -5% within 24h as an initial research definition, plus continuous returns and MFE/MAE.
- Evaluate early warning separately from confirmed entries. Deduplicate overlapping alerts and avoid survivor bias.
- Time-ordered walk-forward with purging/embargo; reserve untouched final holdout.
- Simulate spreads, fees, slippage, market impact and adverse OHLC intrabar ordering; report trade count, precision, recall, lead time, net expectancy, drawdown and sensitivity.
- Compare against existing breakout baseline and matched random entry baseline.
- Do not promote based on win rate alone. Require positive out-of-sample net expectancy and credible robustness across dates/pairs.
- If historical trade/depth data is absent, mark those metrics UNTESTED; never synthesize it.

## Next steps
1. Build reproducible Alpha data acquisition with checkpointing and rate-limit compliance.
2. Persist immutable raw snapshots with source metadata and coverage audit.
3. Implement causal features and event-driven simulator.
4. Produce a machine-readable report and run a shadow/paper phase before any deployment.

Production worker/index.mjs must remain unchanged. No credentials in repository.
