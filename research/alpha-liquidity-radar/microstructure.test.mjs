import test from 'node:test';
import assert from 'node:assert/strict';
import {depthMetrics,compareDepth,signedKlineFlow,formatPaperMessage} from './microstructure.mjs';
const snapshot=()=>({timestamp:1000,bids:[[99.5,10],[99,10]],asks:[[100.5,10],[101,10]]});
test('spread, depth, imbalance and 200USDT impact',()=>{
 const m=depthMetrics(snapshot());assert.equal(m.mid,100);assert.equal(m.spreadRelativeMid,.01);assert.equal(m.bidQuoteDepth,1985);assert.equal(m.askQuoteDepth,2015);assert.equal(m.imbalance,-.0075);assert.equal(m.buy.averagePrice,100.5);assert.equal(m.sell.averagePrice,99.5);assert.equal(m.notionalUSDT,200);
});
test('insufficient snapshot depth has no made-up impact',()=>{
 const s=snapshot();s.bids=[[99.5,.1]];s.asks=[[100.5,.1]];const m=depthMetrics(s);assert.equal(m.buy.status,'INSUFFICIENT_DEPTH');assert.equal(m.sell.status,'INSUFFICIENT_DEPTH');assert.equal(m.buy.impactRelativeMid,null);
});
test('invalid, crossed, duplicate, stale and future books rejected',()=>{
 assert.throws(()=>depthMetrics({...snapshot(),bids:[[101,1]]}));assert.throws(()=>depthMetrics({...snapshot(),asks:[[100.5,1],[100.5,2]]}));assert.throws(()=>depthMetrics(snapshot(),{now:100000}));assert.throws(()=>depthMetrics(snapshot(),{now:0}));assert.throws(()=>depthMetrics({...snapshot(),bids:[[null,1]]}));assert.throws(()=>depthMetrics(snapshot(),{notionalUSDT:NaN}));
});
test('sequential snapshots report displayed-depth differences only',()=>{
 const a=snapshot(),b=snapshot();b.timestamp=2000;b.bids[0][1]=11;const m=compareDepth(a,b,{now:2000});assert.equal(m.bidQuoteDepthChange,99.5);assert.match(m.interpretation,/Not actual net inflows/);assert.throws(()=>compareDepth(b,a));assert.throws(()=>compareDepth(a,a));assert.throws(()=>compareDepth(a,b,{now:100000}));
});
test('signed flow requires verified semantics and bounded taker values',()=>{
 const row=[0,1,1,1,1,100,999,100,1,60,60];assert.equal(signedKlineFlow([row]).status,'UNVERIFIED');const v=signedKlineFlow([row],{verifiedAggressorSemantics:true});assert.equal(v.cvd,20);row[10]=101;assert.throws(()=>signedKlineFlow([row],{verifiedAggressorSemantics:true}));
});
test('paper formatter never assigns calibrated probability or sends',()=>{
 const e={kind:'warning',name:'Example',symbol:'ALPHA_X',timestamp:1000,price:1,reasons:['relative volume']};const w=formatPaperMessage(e);assert.equal(w.status,'WATCH_ONLY');assert.equal(w.score,null);const c=formatPaperMessage({...e,kind:'confirmation',stop:.9,targets:[1.1,1.2]});assert.equal(c.status,'PAPER_ONLY');assert.equal(c.score,null);assert.throws(()=>formatPaperMessage({...e,kind:'confirmation',stop:2,targets:[3]}));
});
