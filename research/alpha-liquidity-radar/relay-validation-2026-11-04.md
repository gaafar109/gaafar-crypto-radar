# Isolated Apps Script relay validation — 2026-11-04

## Outcome
PARTIAL / BLOCKED — the separate relay was created and deployed, but no usable Binance market-data response was received. This is not a successful live liquidity feed, a validated trading strategy, or a successful authenticated end-to-end POST test.

## Deployed setup
- Project: GAAFARYPTO Research Relay V2 - TEST
- Project URL: https://script.google.com/home/projects/1JAmjzj9DvpTx0xj-QhVe2_ADBFG7gnFq0SsXhshiu4rfjfYQppZCt670/edit
- Web app version: 1, deployed 2026-11-04 at 04:44 Africa/Cairo.
- Execute as deploying user; access MYSELF (Google authentication required).
- OAuth scope: https://www.googleapis.com/auth/script.external_request only.
- RESEARCH_RELAY_KEY: generated with Node crypto.randomBytes(32), stored in Script Properties. No secret value is included here, in source, or in logs.
- Source based on research-relay.gs from the requested branch, blob ee0615c8a23a531f2f0cfae8c7ed07b40ed69211. Formatting/comments were shortened in the separate project; relay logic preserved.
- Additional editor-only helpers runResearchProbe and runRelayValidation were saved after deployment. They were run from the editor, not included in deployment version 1.
- Original bot, original Apps Script relay, and production integrations were not changed. No trading signals or trades were sent.

## Actual upstream requests
Base: https://www.binance.com/bapi/defi/v1/public/alpha-trade
Transport: Google Apps Script UrlFetchApp, muteHttpExceptions=true, followRedirects=false.

| UTC response time | Request | HTTP | Body |
|---|---|---|---|
| 2026-11-04T02:46:44.715Z | /get-exchange-info | 403 | HTML Forbidden |
| 2026-11-04T02:46:44.925Z | /agg-trades?symbol=ALPHA_175USDT&limit=10 | 403 | HTML Forbidden |
| 2026-11-04T02:46:45.142Z | /fullDepth?symbol=ALPHA_175USDT&limit=20 | 403 | HTML Forbidden |

Body observed for each:
```html
<html>
<head><title>403 Forbidden</title></head>
<body>
<center><h1>403 Forbidden</h1></center>
</body>
</html>
```

KEY_CONFIGURED=true was observed. No key value was printed.
Raw observations were recorded in execution logs and RESEARCH_LAST_PROBE in the separate project's Script Properties.

## Relay-handler checks
Invoked doPost directly from the Apps Script editor with synthetic request envelopes; this is NOT an external HTTP POST to /exec.

| UTC test start | Case | Result |
|---|---|---|
| 2026-11-04T02:47:23.165Z | Missing key | ok=false, unauthorized |
| 2026-11-04T02:47:23.202Z | Valid key, unsupported endpoint | ok=false, unsupported endpoint |
| 2026-11-04T02:47:23.237Z | Valid key, aggTrades | ok=false, upstream_http_403 |
| 2026-11-04T02:47:23.509Z | Valid key, depth | ok=false, upstream_http_403 |

Results also stored in RESEARCH_RELAY_VALIDATION.

## Documentation review versus runtime evidence
Official source reviewed:
https://developers.binance.com/en/docs/catalog/advanced-trading-alpha-trading/api/rest-api/market-data

- Both endpoint paths and the selected depth limit (20) match the official documentation.
- Aggregated trades are documented as data[] with a,p,q,f,l,T,m. Price and quantity are strings.
- The m field is documented as buyer-is-maker, but deprecated. Its theoretical taker-side interpretation is m=true => aggressive seller, m=false => aggressive buyer. This interpretation was NOT validated against live Alpha observations and must not be used as a confirmed flow signal.
- Depth is documented as data with bids/asks arrays of [price, quantity]. Resting order-book liquidity is not executed net buying.
- No live schema, current symbol status, or buyer/seller-side accuracy was validated because all responses were HTML 403.
- The source relay accepts any integer limit 1..1000 for both interfaces. Depth actually documents the discrete set 5,10,20,50,100,500,1000. This should be tightened in a future code change; it did not cause the observed failure because this test used 20.

## Diagnosis and limits
The common 403 across both trading endpoints and the symbol-free exchange-info request is consistent with a broader access refusal on this request path. It does not establish whether the underlying cause is geography, source IP, upstream policy, or another filter. There was no evidence identifying a CAPTCHA or bot challenge, and no reason is established from the bare 403 alone.

The relay key is only for caller-to-relay authentication; it is not a Binance API key and is never sent to Binance. Changing it cannot resolve the observed upstream refusal.

A later attempt to resume the project found the browser signed out; Google returned “Something went wrong” after secure sign-in submission. No further project edits or web-app integration tests were completed in that attempt.

## Acceptance status / continuation
1. Separate project and minimal scope: completed.
2. Strong Script Properties key: completed and presence verified.
3. Restricted web-app deployment: completed.
4. Actual Binance requests and recorded failures: completed.
5. Successful live payload and direction validation: BLOCKED by upstream 403.
6. Full authenticated /exec POST roundtrip: NOT TESTED. MYSELF requires Google authentication in addition to the relay key; do not claim machine-client readiness.
7. Production changes/signals: none.

Next concrete work: resolve upstream access through a supported Binance access path/support response and then test a fully authenticated private web-app POST roundtrip. Re-test valid current symbols and schema only after real JSON succeeds. Keep RAW_UNVERIFIED and withhold net-buying metrics and signals until taker-side semantics have independent evidence. Do not weaken Google access settings, rotate secrets, replace production, or label the work complete merely to bypass these blockers.

## Final follow-up — 2026-11-04 17:24 Africa/Cairo
Google sign-in was successfully restored and the existing project reopened. No replacement project or secret was created. Added and ran editor-only runFinalConnectivityCheck; production version 1 remains unchanged.

| UTC response time | Request | Actual result |
|---|---|---|
| 15:24:32.670Z | Binance exchangeInfo | HTTP 403, text/html, 118 characters |
| 15:24:33.198Z | Binance aggTrades, ALPHA_175USDT, limit 10 | HTTP 403, text/html, 118 characters |
| 15:24:33.452Z | Binance fullDepth, ALPHA_175USDT, limit 20 | HTTP 403, text/html, 118 characters |
| 15:24:33.810Z | Real HTTP POST to deployed /exec, valid relay key, no Google session | HTTP 401, text/html; charset=utf-8, 7913 characters |

These requests used Accept: application/json and disabled redirect following. Binance returned the same Forbidden HTML. The POST was sent by UrlFetchApp to the project's own deployment; the key remained inside the request body and was not logged. This is a real transport test, but Google authentication was deliberately absent, so it does not validate the handler through an authenticated HTTP request. The body length field called bytes in the helper is actually JavaScript string length; it is not a measured wire-byte count.

A separate GET from the signed-in browser to the exact deployment URL rendered “Script function not found: doGet”. This demonstrates authenticated reachability of the deployment, not successful POST execution. It is expected because this relay only implements doPost; doGet was not added as an authentication bypass.

Sanitized follow-up observations are preserved in the execution log and RESEARCH_FINAL_CONNECTIVITY. Final diagnosis separates two layers: Google rejects unauthenticated machine requests to MYSELF with 401; Binance independently rejects outbound market-data requests with 403. Changing Google sharing cannot resolve the Binance failure. No live payload, direction semantics, or net-buying metric is validated. Final acceptance remains BLOCKED for live-data operation; successful setup and recorded failure tests must not be represented as a working liquidity feed.
