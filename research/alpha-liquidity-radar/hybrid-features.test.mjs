import test from 'node:test';
import assert from 'node:assert/strict';
import {features,scoreSnapshot} from './hybrid-features.mjs';
const rows=Array.from({length:60},(_,i)=>({t:i*60000,o:100+i*.1,h:101+i*.1,l:99+i*.1,c:100+i*.1,v:100}));
test('fails closed without trade prints and depth',()=>{
 const f=features(rows);
 assert.equal(f.liquidity,null);assert.equal(f.hybrid,null);
 assert.equal(scoreSnapshot(f).status,'INSUFFICIENT_DATA');
});
test('requires validated aggressor labels',()=>{
 assert.throws(()=>features(rows,{trades:[{qty:5,aggressor:'unknown'}]}),/unverified/);
});
test('rejects malformed candle',()=>{
 const bad=rows.map(x=>({...x}));bad[20].h=0;
 assert.throws(()=>features(bad),/invalid/);
});
test('validates order book and computes flow',()=>{
 const f=features(rows,{trades:[{qty:7,aggressor:'buy'},{qty:3,aggressor:'sell'}],book:{bids:[{qty:8}],asks:[{qty:2}]}});
 assert.equal(f.flow.delta,4);assert.equal(f.book.imbalance,0.6);
 assert.equal(f.liquidity,true);
});
