// Research-only observations and text formatting. This module performs no I/O.
function finite(x,label,min=0){if(typeof x!=='number'||!Number.isFinite(x)||x<min)throw new RangeError(label);return x;}
function level(x){
 if(!Array.isArray(x)||x.length<2||x[0]===''||x[1]===''||x[0]===null||x[1]===null)throw new Error('invalid depth level');
 const p=Number(x[0]),q=Number(x[1]);finite(p,'price',Number.MIN_VALUE);finite(q,'quantity');return [p,q];
}
function book(snapshot,opts={}){
 if(!snapshot||!Array.isArray(snapshot.bids)||!Array.isArray(snapshot.asks))throw new Error('invalid book');
 const stamp=finite(snapshot.timestamp,'snapshot timestamp');
 const now=opts.now===undefined?stamp:finite(opts.now,'now'),maxAgeMs=finite(opts.maxAgeMs??30000,'maxAgeMs');
 if(stamp>now)throw new Error('future snapshot');if(now-stamp>maxAgeMs)throw new Error('stale snapshot');
 const bids=snapshot.bids.map(level).filter(x=>x[1]>0).sort((a,b)=>b[0]-a[0]);
 const asks=snapshot.asks.map(level).filter(x=>x[1]>0).sort((a,b)=>a[0]-b[0]);
 if(!bids.length||!asks.length)throw new Error('empty side');
 if(new Set(bids.map(x=>x[0])).size!==bids.length||new Set(asks.map(x=>x[0])).size!==asks.length)throw new Error('duplicate price');
 if(bids[0][0]>=asks[0][0])throw new Error('crossed or locked book');
 return {timestamp:stamp,bids,asks,mid:(bids[0][0]+asks[0][0])/2};
}
export function depthMetrics(snapshot,opts={}){
 const {bids,asks,mid,timestamp}=book(snapshot,opts),band=finite(opts.band??.01,'band',Number.MIN_VALUE),notional=finite(opts.notionalUSDT??200,'notional',Number.MIN_VALUE);
 if(band>=1)throw new RangeError('band must be <1');
 const bidQuoteDepth=bids.filter(x=>x[0]>=mid*(1-band)).reduce((s,[p,q])=>s+p*q,0);
 const askQuoteDepth=asks.filter(x=>x[0]<=mid*(1+band)).reduce((s,[p,q])=>s+p*q,0);
 const total=bidQuoteDepth+askQuoteDepth;
 let remaining=notional,base=0;
 for(const [p,q] of asks){const quote=Math.min(remaining,p*q);base+=quote/p;remaining-=quote;if(remaining<=notional*1e-12)break;}
 const buy=remaining>notional*1e-12?{status:'INSUFFICIENT_DEPTH',averagePrice:null,impactRelativeMid:null}:{status:'AVAILABLE',averagePrice:notional/base,impactRelativeMid:notional/base/mid-1};
 let remainingBase=notional/mid,proceeds=0;
 for(const [p,q] of bids){const amount=Math.min(remainingBase,q);proceeds+=amount*p;remainingBase-=amount;if(remainingBase<=notional/mid*1e-12)break;}
 const sell=remainingBase>notional/mid*1e-12?{status:'INSUFFICIENT_DEPTH',averagePrice:null,impactRelativeMid:null}:{status:'AVAILABLE',averagePrice:proceeds/(notional/mid),impactRelativeMid:1-proceeds/notional};
 return {timestamp,mid,spreadRelativeMid:(asks[0][0]-bids[0][0])/mid,band,bidQuoteDepth,askQuoteDepth,imbalance:total?(bidQuoteDepth-askQuoteDepth)/total:null,notionalUSDT:notional,buy,sell,interpretation:'Displayed snapshot liquidity only; no spoofing conclusion, fill guarantee or net-inflow measurement. Impact excludes fees and latency.'};
}
export function compareDepth(previous,current,opts={}){
 if(!previous||!current||current.timestamp<=previous.timestamp)throw new Error('timestamps must increase');
 const a=depthMetrics(previous,{...opts,now:previous.timestamp}),b=depthMetrics(current,opts);
 return {from:a.timestamp,to:b.timestamp,bidQuoteDepthChange:b.bidQuoteDepth-a.bidQuoteDepth,askQuoteDepthChange:b.askQuoteDepth-a.askQuoteDepth,imbalanceChange:a.imbalance===null||b.imbalance===null?null:b.imbalance-a.imbalance,interpretation:'Changes in displayed quote depth within a moving mid-price band; cancellations, repricing and executions cannot be separated. Not actual net inflows or proof of spoofing.'};
}
export function signedKlineFlow(rows,{verifiedAggressorSemantics=false}={}){
 if(verifiedAggressorSemantics!==true)return {status:'UNVERIFIED',delta:null,cvd:null,reason:'Aggressor-side field semantics must be independently verified; OHLCV alone is insufficient.'};
 if(!Array.isArray(rows))throw new Error('rows must be an array');
 let cumulative=0,last=-Infinity;const values=[];
 for(const r of rows){
  if(!Array.isArray(r)||r.length<11||[r[0],r[7],r[10]].some(x=>x===null||x===''||!Number.isFinite(Number(x))))throw new Error('missing verified taker fields');
  const timestamp=Number(r[0]),total=Number(r[7]),buy=Number(r[10]);finite(timestamp,'timestamp');finite(total,'quote volume');finite(buy,'taker buy quote');
  if(timestamp<=last||buy>total)throw new Error('invalid taker bounds or chronology');
  last=timestamp;const delta=2*buy-total;cumulative+=delta;values.push({timestamp,delta,cvd:cumulative});
 }
 return {status:'VERIFIED_BY_CALLER',unit:'quote asset',values,delta:values.map(x=>x.delta),cvd:cumulative,interpretation:'Signed executed quote volume, not net capital inflows. CVD starts at zero at the beginning of the provided sample.'};
}
const text=x=>String(x??'unknown').replace(/[\r\n]/g,' ');
export function formatPaperMessage(event){
 if(!event||!['warning','confirmation'].includes(event.kind))throw new Error('invalid event kind');
 finite(event.timestamp,'event timestamp');finite(event.price,'event price',Number.MIN_VALUE);
 const reasons=Array.isArray(event.reasons)?event.reasons.map(text):[];
 if(event.kind==='warning')return {status:'WATCH_ONLY',score:null,text:`WATCH_ONLY — ${text(event.name)} (${text(event.symbol)})\n${new Date(event.timestamp).toISOString()}\nWarning price: ${event.price}\nReasons: ${reasons.join('; ')}\nUncalibrated research warning; no entry instruction.`};
 finite(event.stop,'stop',Number.MIN_VALUE);if(event.stop>=event.price)throw new Error('stop must be below entry');
 if(!Array.isArray(event.targets)||!event.targets.length||event.targets.some((x,i)=>typeof x!=='number'||!Number.isFinite(x)||x<=event.price||(i>0&&x<=event.targets[i-1])))throw new Error('invalid targets');
 return {status:'PAPER_ONLY',score:null,text:`PAPER_ONLY — ${text(event.name)} (${text(event.symbol)})\n${new Date(event.timestamp).toISOString()}\nReference entry: ${event.price}\nStop: ${event.stop}\nTargets: ${event.targets.join(' / ')}\nReasons: ${reasons.join('; ')}\nUncalibrated simulation; no actual order or execution.`};
}
