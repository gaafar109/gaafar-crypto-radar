// Research-only signed trade flow. No network, orders or production integration.
// Input records: {time, price, quantity, buyerIsMaker}. Binance aggTrades 'm':
// true means buyer was maker => seller aggressed; false => buyer aggressed.
export function aggregateAggressorFlow(trades, {start=-Infinity,end=Infinity}={}) {
  if (!Array.isArray(trades)) throw new TypeError('trades must be an array');
  let buyQuote=0, sellQuote=0, count=0, previous=-Infinity;
  for (const t of trades) {
    const time=Number(t.time), price=Number(t.price), quantity=Number(t.quantity);
    if (!Number.isFinite(time)||!Number.isFinite(price)||!Number.isFinite(quantity)||
        price<=0||quantity<=0||typeof t.buyerIsMaker!=='boolean'||
        time<previous) throw new RangeError('invalid or unordered aggressor trade');
    previous=time;
    if (time<start||time>=end) continue;
    const notional=price*quantity;
    if(t.buyerIsMaker) sellQuote+=notional; else buyQuote+=notional;
    count++;
  }
  const gross=buyQuote+sellQuote;
  return {count,buyQuote,sellQuote,netAggressiveQuote:buyQuote-sellQuote,
    imbalance:gross>0?(buyQuote-sellQuote)/gross:null,
    cvdQuote:buyQuote-sellQuote,
    interpretation:'executed aggressor imbalance, NOT net capital inflow'};
}
export function orderBookImbalance({bids,asks},levels=10) {
  if(!Array.isArray(bids)||!Array.isArray(asks)||!Number.isInteger(levels)||levels<1)
    throw new TypeError('invalid depth');
  const sum=rows=>rows.slice(0,levels).reduce((s,r)=>{
    const p=Number(r[0]),q=Number(r[1]);
    if(!Number.isFinite(p)||!Number.isFinite(q)||p<=0||q<0)throw new RangeError('invalid depth level');
    return s+p*q;
  },0);
  const bidQuote=sum(bids),askQuote=sum(asks),total=bidQuote+askQuote;
  return {bidQuote,askQuote,imbalance:total?(bidQuote-askQuote)/total:null,
    interpretation:'resting displayed liquidity, cancellable; not executed flow'};
}
