import test from 'node:test';
import assert from 'node:assert/strict';
import {replay} from './backtest.mjs';
const rows=Array.from({length:90},(_,i)=>({t:i*60000,o:100+i*.1,h:101+i*.1,l:99+i*.1,c:100+i*.1,v:100}));
test('no unverified flow means no trades',()=>{const r=replay(rows);assert.equal(r.count,0);assert.equal(r.winRate,null);});
test('reject insufficient candles',()=>assert.throws(()=>replay(rows.slice(0,20)),/insufficient/));
test('reject invalid costs',()=>assert.throws(()=>replay(rows,{feeBps:-1}),/invalid/));