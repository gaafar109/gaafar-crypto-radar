import assert from 'node:assert/strict';
import test from 'node:test';
import {computeWarnings,confirmWarnings,simulate,summarize} from './liquidity.mjs';
const bars=(n=65)=>Array.from({length:n},(_,i)=>[i*60000,1,1.02,0.98,1,100,i*60000+59999,i===48?1000:100]);
const signal=(i)=>({entryIndex:i,entry:99});
test('causal volume warning and prefix invariance',()=>{
 const a=bars(),w=computeWarnings(a,{compressionMax:.1});
 assert.equal(w[0].warning,true);assert.equal(w[0].volumeRatio,10);assert.equal(w[1].warning,false);
 assert.deepEqual(computeWarnings(a.slice(0,55)),computeWarnings(a).filter(x=>x.index<55));
 assert.deepEqual(computeWarnings(a,{now:a[55][0]}),computeWarnings(a.slice(0,55)));
});
test('confirmation enters only following open and deduplicates',()=>{
 const a=bars();a[49][4]=1.04;a[49][2]=1.05;a[50][1]=1.04;a[50][2]=1.05;
 const w=computeWarnings(a);const s=confirmWarnings(a,[...w,...w]);
 assert.equal(s.length,1);assert.equal(s[0].entryIndex,50);assert.equal(s[0].entry,1.04);
 assert.equal(confirmWarnings(a,w,{now:a[50][0]}).length,0);
});
test('stop wins ambiguous candle, supplied entry is ignored',()=>{
 const a=bars();a[50][3]=.8;a[50][2]=1.2;
 const [t]=simulate(a,[signal(50)],{horizonBars:1});assert.equal(t.reason,'stop');assert.equal(t.entry,1.001);
});
test('gap below stop fills adverse opening price',()=>{
 const a=bars();a[51]=[51*60000,.7,.8,.6,.75,100,51*60000+59999,100];
 const [t]=simulate(a,[signal(50)],{horizonBars:2,slippageEachSide:0,feeEachSide:0});assert.equal(t.exit,.7);assert.equal(t.netReturn,.7-1);
});
test('full horizon required even if target happens in truncated data',()=>{
 const a=bars();a[64][2]=2;assert.equal(simulate(a,[signal(64)],{horizonBars:2})[0].reason,'insufficient-data');
});
test('overlap blocked until actual exit, then permits later entry',()=>{
 const a=bars();const t=simulate(a,[signal(50),signal(51),signal(53)],{horizonBars:3});
 assert.deepEqual(t.map(x=>x.reason),['timeout','overlap-skipped','timeout']);
});
test('gaps exclude features and simulated trades',()=>{
 const a=bars();a.splice(51,1);
 assert.equal(simulate(a,[signal(50)],{horizonBars:3})[0].reason,'data-gap');
 assert.ok(computeWarnings(a).every(x=>x.index<51));
});
test('invalid OHLC, chronology, parameters rejected',()=>{
 const a=bars();a[0][1]=3;assert.throws(()=>computeWarnings(a));
 const b=bars();b[1][0]=0;assert.throws(()=>simulate(b,[]));
 assert.throws(()=>simulate(bars(),[],{sl:1}));assert.throws(()=>computeWarnings(bars(),{lookback:NaN}));
});
test('fees charged on each side actual notional',()=>{
 const [t]=simulate(bars(),[signal(50)],{horizonBars:1,slippageEachSide:0,feeEachSide:.01});
 assert.equal(t.netReturn,.99/1.01-1);
});
test('summary distinguishes trade expectancy from portfolio',()=>{
 const s=summarize([{netReturn:.1,reason:'target'},{netReturn:-.05,reason:'stop'},{netReturn:null}]);
 assert.equal(s.winRate,.5);assert.equal(s.profitFactor,2);assert.equal(s.meanNetReturn,.025);assert.equal(s.skipped,1);
 assert.equal(summarize([]).winRate,null);
});
