import {features} from './hybrid-features.mjs';
export function replay(candles,{feeBps=10,slippageBps=5,horizon=12,stopPct=.05,takePct=.10,flowByTimestamp=new Map()}={}){
 if(!Array.isArray(candles)||candles.length<56)throw Error('insufficient candles');
 if(!(flowByTimestamp instanceof Map)||![feeBps,slippageBps,horizon,stopPct,takePct].every(Number.isFinite)||feeBps<0||slippageBps<0||!Number.isInteger(horizon)||horizon<1||stopPct<=0||stopPct>=1||takePct<=0)throw Error('invalid options');
 const trades=[];let nextEligible=55;
 for(let i=54;i<candles.length-1;i++){
  if(i<nextEligible)continue;
  const slice=candles.slice(0,i+1),flow=flowByTimestamp.get(Number(slice.at(-1).t));
  const s=features(slice,flow||{});
  if(s.hybrid!==true)continue;
  const entryIndex=i+1,entry=Number(candles[entryIndex].o)*(1+slippageBps/10000);
  const stop=entry*(1-stopPct),take=entry*(1+takePct);
  let exitIndex=Math.min(candles.length-1,entryIndex+horizon-1),exitPrice=Number(candles[exitIndex].c)*(1-slippageBps/10000),reason='timeout';
  for(let j=entryIndex;j<=exitIndex;j++){
   const bar=candles[j];
   if(Number(bar.l)<=stop){exitIndex=j;exitPrice=stop*(1-slippageBps/10000);reason='stop';break;}
   if(Number(bar.h)>=take){exitIndex=j;exitPrice=take*(1-slippageBps/10000);reason='take';break;}
  }
  const netReturn=exitPrice/entry-1-2*feeBps/10000;
  trades.push({signalTime:s.t,entryIndex,exitIndex,entry,exitPrice,reason,netReturn});
  nextEligible=exitIndex+1;
 }
 const count=trades.length,wins=trades.filter(t=>t.netReturn>0).length;
 let equity=1,peak=1,maxDrawdown=0;
 for(const t of trades){equity*=1+t.netReturn;peak=Math.max(peak,equity);maxDrawdown=Math.max(maxDrawdown,1-equity/peak);}
 return {count,wins,winRate:count?wins/count:null,avgNetReturn:count?trades.reduce((s,t)=>s+t.netReturn,0)/count:null,totalCompoundedReturn:equity-1,maxDrawdown,trades};
}