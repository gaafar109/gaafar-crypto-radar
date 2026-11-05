// Research only. No network, order placement, Telegram or production state.
// Inputs are closed OHLCV bars; pass now to enforce an information cutoff.
const number=(v,name,min=0,max=Infinity)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>=max)throw new RangeError(name);return v;};
const integer=(v,name,min=1)=>{number(v,name,min);if(!Number.isInteger(v))throw new RangeError(name);return v;};
function validated(rows){
 if(!Array.isArray(rows))throw new TypeError('rows must be an array');
 return rows.map((r,i)=>{
  if(!Array.isArray(r)||r.length<8||r.slice(0,8).some(x=>x===null||x===''||!Number.isFinite(Number(x))))throw new Error(`invalid bar ${i}`);
  const a=r.map(Number),[t,o,h,l,c,v,end,q]=a;
  if(t<0||end<t||o<=0||l<=0||h<l||o>h||o<l||c>h||c<l||v<0||q<0||(i&&t<=Number(rows[i-1][0])))throw new Error(`invalid OHLC/time at ${i}`);
  return a;
 });
}
const contiguous=(a,start,end)=>{for(let i=start;i<=end;i++){if(i>start&&a[i][0]!==a[i-1][6]+1)return false;if(i>start&&a[i][6]-a[i][0]!==a[start][6]-a[start][0])return false;}return true;};
function cutoff(opts){if(opts.now===undefined)return Infinity;return number(opts.now,'now');}
export function computeWarnings(rows,opts={}){
 const a=validated(rows),lookback=integer(opts.lookback??48,'lookback'),volRatio=number(opts.volRatio??2,'volRatio'),compressionMax=number(opts.compressionMax??0.07,'compressionMax'),now=cutoff(opts),out=[];
 for(let i=lookback;i<a.length;i++){
  if(a[i][6]>=now||!contiguous(a,i-lookback,i))continue;
  const history=a.slice(i-lookback,i),bar=a[i],q=bar[7],close=bar[4];
  const avg=history.reduce((s,r)=>s+r[7],0)/lookback;
  const high=Math.max(...history.map(x=>x[2])),low=Math.min(...history.map(x=>x[3]));
  const compression=(high-low)/close,ratio=avg>0?q/avg:0;
  out.push({index:i,openTime:bar[0],closeTime:bar[6],close,quoteVolume:q,volumeRatio:ratio,compression,warning:ratio>=volRatio&&compression<=compressionMax});
 }
 return out;
}
export function confirmWarnings(rows,warnings,opts={}){
 const a=validated(rows),expiry=integer(opts.expiryBars??12,'expiryBars'),buffer=number(opts.breakoutBuffer??0.001,'breakoutBuffer'),now=cutoff(opts),signals=[];
 for(const w of warnings.filter(x=>x.warning)){
  integer(w.index,'warning index',0);if(w.index>=a.length||a[w.index][6]>=now)continue;
  const start=Math.max(0,w.index-20);
  if(!contiguous(a,start,w.index))continue;
  const resistance=Math.max(...a.slice(start,w.index+1).map(r=>r[2]));
  for(let j=w.index+1;j<=Math.min(a.length-2,w.index+expiry);j++){
   if(a[j][6]>=now||a[j+1][0]>=now||!contiguous(a,w.index,j+1))break;
   if(a[j][4]>resistance*(1+buffer)){
    signals.push({warningIndex:w.index,confirmIndex:j,entryIndex:j+1,entry:a[j+1][1],warningLeadBars:j-w.index});break;
   }
  }
 }
 const used=new Set();return signals.sort((x,y)=>x.entryIndex-y.entryIndex||x.warningIndex-y.warningIndex).filter(x=>{if(used.has(x.entryIndex))return false;used.add(x.entryIndex);return true;});
}
export function simulate(rows,signals,opts={}){
 const a=validated(rows),tp=number(opts.tp??0.10,'tp',Number.MIN_VALUE),sl=number(opts.sl??0.05,'sl',Number.MIN_VALUE,1),horizon=integer(opts.horizonBars??96,'horizonBars'),fee=number(opts.feeEachSide??0.001,'feeEachSide',0,1),slippage=number(opts.slippageEachSide??0.001,'slippageEachSide',0,1),now=cutoff(opts);
 let busyThrough=-1;const out=[];
 for(const s of [...signals].sort((x,y)=>x.entryIndex-y.entryIndex)){
  integer(s.entryIndex,'entryIndex',0);const start=s.entryIndex,last=start+horizon-1;
  if(start<=busyThrough){out.push({...s,reason:'overlap-skipped',netReturn:null});continue;}
  if(last>=a.length||a[last][6]>=now){out.push({...s,reason:'insufficient-data',netReturn:null});continue;}
  if(!contiguous(a,start,last)){out.push({...s,reason:'data-gap',netReturn:null});continue;}
  const entry=a[start][1]*(1+slippage),stop=entry*(1-sl),target=entry*(1+tp);
  let exit=a[last][4],reason='timeout',exitIndex=last;
  for(let i=start;i<=last;i++){
   const [,open,high,low]=a[i];
   if(low<=stop){exit=Math.min(stop,open);reason='stop';exitIndex=i;break;}
   if(high>=target){exit=target;reason='target';exitIndex=i;break;}
  }
  busyThrough=exitIndex;
  const exitFill=exit*(1-slippage),netReturn=exitFill*(1-fee)/(entry*(1+fee))-1;
  out.push({...s,entry,exit:exitFill,exitIndex,entryTime:a[start][0],exitTime:a[exitIndex][6],reason,netReturn});
 }
 return out;
}
export function summarize(trades){
 const done=trades.filter(t=>Number.isFinite(t.netReturn)),n=done.length,gains=done.reduce((s,t)=>s+Math.max(t.netReturn,0),0),losses=-done.reduce((s,t)=>s+Math.min(t.netReturn,0),0),targets=done.filter(t=>t.reason==='target').length;
 const mean=n?(gains-losses)/n:null;
 return {signals:trades.length,evaluable:n,skipped:trades.length-n,targets,stops:done.filter(t=>t.reason==='stop').length,winRate:n?done.filter(t=>t.netReturn>0).length/n:null,meanNetReturn:mean,expectancy:mean,profitFactor:losses?gains/losses:null,profitFactorUndefinedReason:losses?null:'no losses or no trades',targetMissRate:n?1-targets/n:null,sumTradeReturns:n?gains-losses:null,metricScope:'equal-notional trade returns; not portfolio return or drawdown'};
}
