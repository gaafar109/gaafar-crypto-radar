// Research only. Common-capital replay of already generated historical trades.
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
export function replayPortfolio(trades,rowMap,options={}){
 const initial=options.initialCapital??1000,maxSlots=options.maxSlots??5,maxNotional=options.maxNotional??200,minOrder=options.minOrder??5,fee=options.feeEachSide??.001,slippage=options.slippageEachSide??.002,riskFraction=options.riskFraction??.01,stopFraction=options.stopFraction??.05,costAllowance=options.costAllowance??.006,ms=options.frameMs??3600000;
 if(![initial,maxSlots,maxNotional,minOrder,fee,slippage,riskFraction,stopFraction,costAllowance,ms].every(Number.isFinite)||initial<=0||maxSlots<1||!Number.isInteger(maxSlots)||fee<0||fee>=1||slippage<0||slippage>=1||ms<=0||minOrder<0||maxNotional<minOrder||riskFraction<=0||stopFraction+costAllowance<=0)throw Error('invalid portfolio options');
 const ordered=[...trades].sort((a,b)=>a.entryTime-b.entryTime||String(a.symbol).localeCompare(String(b.symbol))),events=new Map(),skipped=[],valid=[],curves=[],fills=[];let id=0;
 const event=t=>{if(!events.has(t))events.set(t,{marks:[],entries:[],exits:[]});return events.get(t)};
 const skip=(t,reason)=>skipped.push({symbol:t.symbol,entryTime:t.entryTime,reason});
 for(const raw of ordered){const t={...raw,id:id++};if(![t.entryTime,t.exitTime,t.entry,t.exit,t.netReturn,t.priorMedianQuote].every(Number.isFinite)||t.entry<=0||t.exit<=0||t.exitTime<t.entryTime||t.netReturn< -1||t.priorMedianQuote<0){skip(t,'invalid-trade');continue;}
  const rows=rowMap[t.symbol];if(!Array.isArray(rows)){skip(t,'missing-bars');continue;}
  const held=rows.filter(r=>Number(r[0])>=t.entryTime&&Number(r[6])<=t.exitTime).map(r=>r.map(Number));
  if(!held.length||held[0][0]!==t.entryTime||held.at(-1)[6]!==t.exitTime){skip(t,'stale-or-missing-boundary-bars');continue;}
  if(held.some((r,i)=>r.length<8||!r.slice(0,8).every(Number.isFinite)||r[3]<=0||r[1]<r[3]||r[1]>r[2]||r[4]<r[3]||r[4]>r[2]||r[7]<0||r[6]-r[0]+1!==ms||(i>0&&r[0]!==held[i-1][6]+1))){skip(t,'gapped-or-invalid-bars');continue;}
  // Ex-post feasibility exclusions, explicitly NOT causal live-trading filters.
  if(t.zeroVolumeEntry||t.zeroVolumeExit||held[0][7]===0||held.at(-1)[7]===0){skip(t,'zero-volume-entry-or-exit');continue;}
  const expected=t.exit*(1-fee)/(t.entry*(1+fee))-1;
  if(Math.abs(expected-t.netReturn)>1e-8){skip(t,'return-cost-inconsistency');continue;}
  valid.push(t);event(t.entryTime).entries.push(t);event(t.exitTime).exits.push(t);
 }
 if(valid.length){const lo=Math.min(...valid.map(t=>t.entryTime)),hi=Math.max(...valid.map(t=>t.exitTime)),symbols=new Set(valid.map(t=>t.symbol));for(const symbol of symbols)for(const raw of rowMap[symbol]){const r=raw.map(Number);if(r[6]>=lo&&r[6]<=hi&&Number.isFinite(r[4])&&r[4]>0)event(r[6]).marks.push({symbol,close:r[4]});}}
 let cash=initial,realizedPnL=0,mtmPeak=initial,realizedPeak=initial,mtmDD=0,realizedDD=0;const positions=new Map(),lastClose=new Map();
 const mark=()=>cash+[...positions.values()].reduce((sum,p)=>sum+p.units*(lastClose.get(p.symbol)??p.entry/(1+slippage))*(1-slippage)*(1-fee),0);
 const observe=(time,kind)=>{const mtm=mark(),realized=initial+realizedPnL;mtmPeak=Math.max(mtmPeak,mtm);realizedPeak=Math.max(realizedPeak,realized);mtmDD=Math.max(mtmDD,mtmPeak>0?(mtmPeak-mtm)/mtmPeak:0);realizedDD=Math.max(realizedDD,realizedPeak>0?(realizedPeak-realized)/realizedPeak:0);curves.push({time,kind,cash,openPositions:positions.size,equityMTM:mtm,equityRealized:realized});};
 for(const [time,ev] of [...events.entries()].sort((a,b)=>a[0]-b[0])){
  // All closes at this timestamp become known together. No later marks are read.
  for(const m of ev.marks)lastClose.set(m.symbol,m.close);
  if(ev.marks.length)observe(time,'closed-bar-before-exits');
  for(const t of ev.exits){const p=positions.get(t.symbol);if(!p||p.id!==t.id)continue;const proceeds=p.notional*(1+t.netReturn),pnl=proceeds-p.notional;cash+=proceeds;realizedPnL+=pnl;positions.delete(t.symbol);fills.push({symbol:t.symbol,entryTime:t.entryTime,exitTime:t.exitTime,notional:p.notional,units:p.units,entry:t.entry,exit:t.exit,netReturn:t.netReturn,pnlUSD:pnl,reason:t.reason});observe(time,'exit');}
  for(const t of ev.entries){if(positions.has(t.symbol)){skip(t,'same-symbol-overlap');continue;}if(positions.size>=maxSlots){skip(t,'slot-limit');continue;}
   const equity=mark(),notional=Math.min(maxNotional,equity*riskFraction/(stopFraction+costAllowance),.01*t.priorMedianQuote,cash);if(notional<minOrder){skip(t,'minimum-order-or-cash-or-capacity');continue;}
   cash-=notional;positions.set(t.symbol,{...t,notional,units:notional/(t.entry*(1+fee))});
   // At an entry open, the execution observation supersedes a stale prior close.
   lastClose.set(t.symbol,t.entry/(1+slippage));observe(time,'entry');
  }
 }
 const finalEquity=mark();return {initialCapital:initial,finalEquity,netProfitUSD:finalEquity-initial,netReturn:finalEquity/initial-1,realizedDrawdown:realizedDD,closeBarMTMDrawdown:mtmDD,trades:fills.length,candidates:ordered.length,skippedCount:skipped.length,openPositionsAtEnd:positions.size,assumptions:{maxSlots,maxNotional,minOrder,feeEachSide:fee,slippageEachSide:slippage,riskFraction,stopFraction,costAllowance,capacity:'notional <=1% prior20-bar median quote turnover',positionSizing:'minimum of $200,1% equity/(5% stop+0.6% cost),capacity,and available cash',entryNotional:'includes entry fee; units =notional/(entry fill*(1+fee))',MTM:'closed raw price with assumed exit slippage and fee; entry observations also included',tieBreak:'alphabetical symbol for simultaneous entries'},limitations:['Historical simulated outcomes are replayed; no orders are placed.','MTM drawdown is sampled at closed bars and entry/exit events, not intrabar or maximum adverse excursion.','Zero-volume entry/exit and missing/gapped execution windows are excluded retrospectively. This is an optimistic feasibility-conditioned diagnostic, not an implementable live selection rule.','Historical spreads, actual queue fills,market impact,and liquidity available within bars remain unverified.','No out-of-sample strategy approval follows from a profitable portfolio replay; statistical independence and capacity evidence remain insufficient.'],fills,skipped,curve:curves};
}
export function runPortfolios(root='data'){
 const trades=JSON.parse(fs.readFileSync(path.join(root,'trades.json'))),out=[];for(const [frame,ms] of Object.entries({'5m':300000,'15m':900000,'1h':3600000,'4h':14400000})){
  const selected=trades.filter(t=>t.strategy==='confirmed'&&t.target===.1&&t.stop===.05&&t.horizonHours===24&&t.costScenario==='base'&&t.fold==='holdout'&&t.frame===frame),rowMap={};for(const symbol of new Set(selected.map(t=>t.symbol))){const p=path.join(root,`${symbol}-${frame}.json`);if(fs.existsSync(p))rowMap[symbol]=JSON.parse(fs.readFileSync(p)).rows;}
  const result=replayPortfolio(selected,rowMap,{frameMs:ms});out.push({...result,frame,strategy:'confirmed',fold:'holdout',target:.1,stop:.05,horizonHours:24});
 }
 fs.writeFileSync(path.join(root,'portfolio.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out.map(({fills,skipped,curve,...r})=>r)));return out;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)runPortfolios(process.argv[2]||'data');
