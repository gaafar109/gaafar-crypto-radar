// Research-only normalization for Binance Alpha aggregated trades.
// Fail closed: never infer aggressor direction from candles or missing maker flags.
// Caller must verify endpoint schema and provenance before marking data usable.
import {aggregateAggressorFlow} from './aggressor-flow.mjs';
export function normalizeAlphaAggTrades(response, {symbol, fetchedAt, source}={}) {
  if(typeof symbol!=='string'||!symbol||typeof source!=='string'||!source||
     !Number.isFinite(fetchedAt)) throw new TypeError('missing provenance');
  if(!response||response.code!=='000000'||!Array.isArray(response.data))
    throw new Error('unexpected Alpha trade response; schema not verified');
  const trades=response.data.map((t,i)=>{
    if(!t||typeof t!=='object'||Array.isArray(t))throw new Error('invalid trade '+i);
    // Standard aggTrades fields; no fallback to ambiguous alternative field names.
    if(typeof t.m!=='boolean')throw new Error('maker-side field missing or ambiguous');
    const time=Number(t.T),price=Number(t.p),quantity=Number(t.q);
    if(t.T===null||t.p===null||t.q===null||t.T===undefined||t.p===undefined||t.q===undefined)
      throw new Error('missing trade values');
    if(!Number.isSafeInteger(time)||time<0||!Number.isFinite(price)||price<=0||
       !Number.isFinite(quantity)||quantity<=0)throw new Error('invalid trade values');
    return {time,price,quantity,buyerIsMaker:t.m};
  });
  for(let i=1;i<trades.length;i++)if(trades[i].time<trades[i-1].time)
    throw new Error('out-of-order trade timestamps');
  return {symbol,source,fetchedAt,trades,flow:aggregateAggressorFlow(trades),
    validation:'SCHEMA_ONLY; independently verify Alpha maker flag semantics and complete time-window coverage'};
}
