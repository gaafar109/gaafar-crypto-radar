import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAlphaAggTrades} from './alpha-trades.mjs';
const meta={symbol:'ALPHA_1USDT',fetchedAt:1000,source:'fixture'};
test('fixture normalizes standard aggTrades and signed quote volume',()=>{
 const r=normalizeAlphaAggTrades({code:'000000',data:[{T:1,p:'2',q:'3',m:true},{T:2,p:'2',q:'5',m:false}]},meta);
 assert.equal(r.flow.netAggressiveQuote,4);
 assert.match(r.validation,/SCHEMA_ONLY/);
});
test('fail closed on absent maker flag',()=>assert.throws(()=>
 normalizeAlphaAggTrades({code:'000000',data:[{T:1,p:'2',q:'3'}]},meta)));
test('fail closed on out-of-order trades',()=>assert.throws(()=>
 normalizeAlphaAggTrades({code:'000000',data:[{T:2,p:'2',q:'3',m:true},{T:1,p:'2',q:'3',m:false}]},meta)));
test('fail closed on missing provenance',()=>assert.throws(()=>
 normalizeAlphaAggTrades({code:'000000',data:[]},{})));
