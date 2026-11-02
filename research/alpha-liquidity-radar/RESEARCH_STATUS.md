# Alpha Liquidity Radar V2: execution checkpoint

This continues branch `research/alpha-liquidity-radar-v2` from commit `082ff0751ba652d5e5c27c8aa55db4fed88b2082`. The production Worker and deployment workflow are unchanged. No order execution or Telegram delivery is added.

The first temporary session ended before its data could be preserved. Its downloads are not counted as completed coverage. The resumed session re-acquires public Binance data and caches immutable source responses. Code is saved incrementally to GitHub.

## Reproduce
From repository root (Python standard library and Node 22+):

```sh
python research/alpha-liquidity-radar/collect.py
python research/alpha-liquidity-radar/collect.py --deepen 4h 1h
python research/alpha-liquidity-radar/snapshots.py
node --test research/alpha-liquidity-radar/*.test.mjs
node research/alpha-liquidity-radar/evaluate.mjs data
node research/alpha-liquidity-radar/depth-report.mjs
```

`data/window.json` fixes the requested 180-day time window. Acquisition is breadth-first for all USDT pairs, including delisted symbols, then paginated when resource budget permits. Raw responses are cached by request SHA256. A partial response or young listing is not 180-day coverage. 403/418/429/451 halt requests; transient transport and server errors receive bounded retries. Do not run concurrent collectors writing the same pair-frame.

## Methods and limits
- Original causal relative-volume/compression warnings and subsequent breakout confirmation are preserved and hardened.
- Simulator uses next-open entry, adverse stop/target ordering, gap stops, exact fee notionals, no overlapping positions per pair/configuration, complete follow-up horizons, and excludes data gaps.
- Compare fixed hypotheses, production entry rules (fixed exits, not production trailing stop tracking), and seeded random entries. 5m production comparator is explicitly adapted, since production has no 5m option.
- Chronological global train/validation/holdout boundaries and a 48-hour embargo. Sequential fixed-policy windows are diagnostics, not optimized walk-forward selection.
- No calibrated prediction probabilities. Current depth snapshots cannot reconstruct historical books. Signed flow is unavailable without independent validation of aggressor semantics. No evidence of whales or DEX net inflows is inferred from candle volume.
- Trade returns are not portfolio returns. Capacity flags, zero-volume fills, multiple testing, missing membership history and previous research exposure constrain interpretation.
- No strategy approved or live paper process started at this checkpoint.

Official market-data API: https://developers.binance.com/en/docs/catalog/advanced-trading-alpha-trading/api/rest-api/market-data
