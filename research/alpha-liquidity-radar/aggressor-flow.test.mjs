import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateAggressorFlow,orderBookImbalance} from './aggressor-flow.mjs';
test('buyer maker means sell aggressor',()=>{
 const r=aggregateAggressorFlow([{time:1,price:2,quantity:3,buyerIsMaker:true},{time:2,price:2,quantity:5,buyerIsMaker:false}]);
 assert.equal(r.sellQuote,6);assert.equal(r.buyQuote,10);assert.equal(r.netAggressiveQuote,4);
});
test('window end exclusive and no trades has null imbalance',()=>{
 assert.equal(aggregateAggressorFlow([{time:2,price:1,quantity:2,buyerIsMaker:false}],{end:2}).imbalance,null);
});
test('reject unknown maker flag',()=>assert.throws(()=>aggregateAggressorFlow([{time:1,price:1,quantity:1}])) );
test('depth uses quote not base units',()=>{
 const r=orderBookImbalance({bids:[[2,5]],asks:[[1,5]]});
 assert.equal(r.imbalance,1/3);
});
