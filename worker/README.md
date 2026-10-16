# Gaafarypto Telegram Worker

This is the existing 2026-10-16.1 Worker, imported without strategy or scanning changes. The radar page at the repository root is separate.

## One-time deployment connection

In this repository, open Settings → Secrets and variables → Actions. Add these repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`: the account containing the existing `gaafarypto` Worker.
- `CLOUDFLARE_API_TOKEN`: a Cloudflare token scoped to that account with Workers Scripts Edit permission. Keep it private; never paste it into chat or code.

The deployment reads the existing Worker's settings and schedules first. It reuses the existing `STATE` KV namespace and exact cron schedule, and keeps dashboard variables and secrets. It refuses to deploy if required settings, storage, schedule, or supported binding types are missing. It does not create a new KV namespace.

After adding secrets, open Actions → Deploy Gaafarypto Worker → Run workflow on main. Subsequent pushes changing `worker/` deploy automatically after checks pass. Read the workflow result; an uploaded code file alone does not prove a production deployment.

## Verification

In Telegram, `/status` should report `2026-10-16.1`. `/price ALPHA_1156USDT alpha` tests Alpha ticker access. `/analyze ALPHA_1156USDT alpha` tests the combined candle analysis and ticker snapshot.

## Current limits

- Alpha scans two rotating pairs each cycle; Spot watchlist contains four pairs.
- Spot was rejected by Binance with HTTP 451 from the hosting location. This import does not resolve that restriction or bypass it.
- Prices are request-time snapshots, not a persistent stream.
- Signals are experimental; no order execution or profitability guarantee.
- No Sharia filter is enabled, as requested for this stage.
- Cloudflare authorization is separate from the ChatGPT GitHub connection. GitHub connection alone cannot deploy to Cloudflare.
