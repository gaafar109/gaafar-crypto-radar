// Research-only: closed-bar causal features. No execution.
export function computeWarnings(rows,opts={}){
 const lookback=opts.lookback??48,volRatio=opts.volRatio??2,compressionMax=opts.compressionMax??0.07,out=[];
 for(let i=lookback;i<rows.length;i++){
  const history=rows.slice(i-lookback,i),bar=rows[i],q=Number(bar[7]),close=Number(bar[4]);
  if(!Number.isFinite(q)||!Number.isFinite(close)||close<=0)continue;
  const pastQ=history.map(x=>Number(x[7]));
  if(pastQ.some(x=>!Number.isFinite(x)||x<0))continue;
  const avg=pastQ.reduce((a,b)=>a+b,0)/lookback;
  const high=Math.max(...history.map(x=>Number(x[2]))),low=Math.min(...history.map(x=>Number(x[3])));
  const compression=(high-low)/close,ratio=avg>0?q/avg:0;
  out.push({index:i,openTime:Number(bar[0]),closeTime:Number(bar[6]),close,quoteVolume:q,volumeRatio:ratio,compression,warning:ratio>=volRatio&&compression<=compressionMax});
 }
 return out;
}
export function confirmWarnings(rows,warnings,opts={}){
 const expiry=opts.expiryBars??12,buffer=opts.breakoutBuffer??0.001,signals=[];
 for(const w of warnings.filter(x=>x.warning)){
  const resistance=Math.max(...rows.slice(Math.max(0,w.index-20),w.index+1).map(r=>Number(r[2])));
  for(let j=w.index+1;j<=Math.min(rows.length-1,w.index+expiry);j++){
   if(Number(rows[j][4])>resistance*(1+buffer)){
    if(j+1<rows.length)signals.push({warningIndex:w.index,confirmIndex:j,entryIndex:j+1,entry:Number(rows[j+1][1]),warningLeadBars:j-w.index});
    break;
   }
  }
 }
 const used=new Set();return signals.filter(x=>{if(used.has(x.entryIndex))return false;used.add(x.entryIndex);return true});
}
export function simulate(rows,signals,opts={}){
 const tp=opts.tp??0.10,sl=opts.sl??0.05,horizon=opts.horizonBars??96,fee=opts.feeEachSide??0.001,slippage=opts.slippageEachSide??0.001;
 return signals.map(s=>{
  const entry=s.entry*(1+slippage),stop=entry*(1-sl),target=entry*(1+tp);
  let exit=null,reason='timeout';
  for(let i=s.entryIndex;i<Math.min(rows.length,s.entryIndex+horizon);i++){
   const high=Number(rows[i][2]),low=Number(rows[i][3]);
   if(low<=stop){exit=stop;reason='stop';break;}
   if(high>=target){exit=target;reason='target';break;}
   exit=Number(rows[i][4]);
  }
  if(exit===null)return {...s,reason:'insufficient-data',netReturn:null};
  return {...s,reason,netReturn:(exit*(1-slippage)/entry-1)-2*fee};
 });
}
export function summarize(trades){
 const done=trades.filter(t=>Number.isFinite(t.netReturn));
 return {signals:trades.length,evaluable:done.length,targets:done.filter(t=>t.reason==='target').length,stops:done.filter(t=>t.reason==='stop').length,winRate:done.length?done.filter(t=>t.netReturn>0).length/done.length:null,meanNetReturn:done.length?done.reduce((s,t)=>s+t.netReturn,0)/done.length:null};
}
