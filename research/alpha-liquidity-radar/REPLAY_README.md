# Research replay runner

The research runner is implemented as `backtest.mjs` with deterministic replay of closed-candle hybrid signals, next-bar entry, conservative same-bar stop precedence, trading fees and slippage. Run `node --test` in this folder.

Limitations: trade-print aggressor labels and order book snapshot timestamp alignment must be validated before accepting any market-data backtest. A missing flow snapshot produces no trade, not an inferred zero. This runner is a prototype and does not establish strategy profitability.