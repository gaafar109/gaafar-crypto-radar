# GAAFARYPTO V2 — Hybrid Signal Research Protocol

Status: RESEARCH ONLY. No production deployment, trades, or Telegram signals.

## Objective
Compare independent TradingView-compatible technical signals, liquidity/order-flow features, ICT/SMC structure features, and their combinations across Binance Alpha and Spot. Select only if net out-of-sample performance is positive and robust.

## Data integrity gates
- Universe: timestamped active USDT instruments, separately Alpha and Spot; record exchange symbol, token contract, chain, listing/delisting, and sampling coverage.
- Obtain OHLCV, actual trade prints and order book snapshots only where accessible; distinguish aggressive buyer/seller trade flow from volume. Do not infer CVD from candles.
- Verify Alpha aggTrades maker/buyer semantics and depth schema against known samples before computing CVD or imbalance. Mark unverified inputs unavailable, never zero.
- Record UTC source timestamps, latency, duplicates, missing candles, order-book depth, staleness, rate limits, and source errors.
- TradingView webhooks are an optional real-time source; historical TradingView alert events cannot be fabricated. Reimplement documented indicator logic for backtests and check parity.

## Strategy arms (all tested separately)
A. Baseline breakout + EMA/RSI/ATR/volume.
B. Technical/TradingView-compatible: trend, momentum, volatility.
C. ICT/SMC: objectively defined BOS/CHOCH, FVG, liquidity sweep, higher-timeframe context; no look-ahead pivots.
D. Order flow: aggressive buy-sell imbalance/CVD and order book imbalance, with spoofing/cancellation caveats.
E. B+C; F. B+D; G. C+D; H. B+C+D.
Do not assign an arbitrary 70/100 quality threshold as evidence of profitability.

## Research design
- Frames 5m, 15m, 1h, 4h, market-specific parameter sets.
- Chronological train/validation/test split and rolling walk-forward; embargo/purge overlapping trade horizons.
- No survivorship bias; compare equal matched universes and periods, and separately report coverage.
- Costs: explicit exchange fees, spread, realistic slippage, depth/size constraints, and partial fills; stop/target order-of-touch ambiguity resolved conservatively with lower-timeframe evidence.
- Evaluate +10% before -5% within 24h as one comparable Alpha early-pump metric, plus strategy-specific exits and fixed-risk R outcomes.
- Metrics: net expectancy per trade, profit factor, win rate, trade count, max drawdown, confidence intervals, exposure, turnover, calibration, and stability by month/coin/market.
- Ablations: compare every component and combined strategy against baseline, and no-trade alternative. Avoid tuning on final holdout.
- Reject deployment if sample insufficient, inputs unverified, or holdout net expectancy nonpositive.

## Signal lifecycle
WATCH (early warning) -> CONFIRMED (entry plan) -> INVALIDATED/EXPIRED -> CLOSED.
Signal includes symbol, chain/contract when relevant, timestamp, source freshness, timeframe, entry condition, invalidation, stop, targets, position-risk assumptions, liquidity checks, and reason codes.
Manual execution only; no Binance trade API permissions.

## Engineering acceptance
1. Add fixture-based unit tests for each feature and anti-look-ahead checks.
2. Add replay/backtest runner with deterministic config and reports.
3. Add source-health dashboard and fail-closed behavior for stale or unavailable liquidity data.
4. Add shadow/paper-trading feed, with no live Telegram trade alerts until validation.
5. Integrate optional TradingView webhook using authenticated endpoint, idempotency, and replay protection.
6. Keep existing production worker, relay, KV, and secrets unchanged.
