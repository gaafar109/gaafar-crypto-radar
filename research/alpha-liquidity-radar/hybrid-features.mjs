// Research-only, pure closed-candle feature engine. No trading or network calls.
export function features(candles, opts={}) {
  const n=candles.length;
  if(n<55) throw new Error('need >=55 closed candles');
  const c=candles.map(x=>({t:Number(x.t),o:Number(x.o),h:Number(x.h),l:Number(x.l),c:Number(x.c),v:Number(x.v)}));
  for(let i=0;i<n;i++){
    const x=c[i];
    if(!Object.values(x).every(Number.isFinite)||x.h<Math.max(x.o,x.c)||x.l>Math.min(x.o,x.c)||x.l<=0||x.v<0||(i&&x.t<=c[i-1].t)) throw new Error('invalid candles');
  }
  const last=c[n-1],prev=c[n-2];
  const ema=(period)=>{let e=c[0].c,k=2/(period+1);for(let i=1;i<n;i++)e+=k*(c[i].c-e);return e;};
  const lookback=c.slice(-21,-1);
  const high=Math.max(...lookback.map(x=>x.h)),low=Math.min(...lookback.map(x=>x.l));
  const bullishBOS=last.c>high && prev.c<=high;
  const bearishBOS=last.c<low && prev.c>=low;
  const fvgBull=c[n-3].h<c[n-1].l;
  const fvgBear=c[n-3].l>c[n-1].h;
  const sweepLow=last.l<low&&last.c>low;
  const sweepHigh=last.h>high&&last.c<high;
  const volumeAvg=lookback.reduce((s,x)=>s+x.v,0)/lookback.length;
  const technical=last.c>ema(50)&&last.v>volumeAvg*1.2;
  // Flow must be actual classified trade prints; do not derive it from OHLCV.
  let flow=null;
  const trades=opts.trades;
  if(Array.isArray(trades)&&trades.length){
    let buy=0,sell=0;
    for(const x of trades){
      if(!Number.isFinite(x.qty)||x.qty<=0||!['buy','sell'].includes(x.aggressor))throw new Error('unverified trades');
      if(x.aggressor==='buy')buy+=x.qty;else sell+=x.qty;
    }
    flow={buy,sell,delta:buy-sell,imbalance:(buy-sell)/(buy+sell)};
  }
  let book=null;
  if(opts.book){
    const sum=a=>{if(!Array.isArray(a)||!a.length)throw new Error('invalid depth');return a.reduce((s,x)=>{if(!Number.isFinite(x.qty)||x.qty<0)throw new Error('invalid depth');return s+x.qty;},0);};
    const bids=sum(opts.book.bids),asks=sum(opts.book.asks);
    if(bids+asks<=0)throw new Error('empty depth');
    book={bids,asks,imbalance:(bids-asks)/(bids+asks)};
  }
  const ict=bullishBOS||sweepLow||fvgBull;
  const liquidity=flow!==null&&book!==null?flow.imbalance>0.1&&book.imbalance>0.1:null;
  return {t:last.t,price:last.c,technical,ict,liquidity,bullishBOS,bearishBOS,fvgBull,fvgBear,sweepLow,sweepHigh,flow,book,
    hybrid:liquidity===null?null:Boolean(technical&&ict&&liquidity)};
}
export function scoreSnapshot(s) {
  if(s.liquidity===null) return {status:'INSUFFICIENT_DATA',score:null};
  const score=(s.technical?1:0)+(s.ict?1:0)+(s.liquidity?1:0);
  return {status:score===3?'CANDIDATE':'NO_TRADE',score}; // heuristic, NOT calibrated win probability
}
