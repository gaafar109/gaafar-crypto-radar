// Run locally: node --test research/alpha-liquidity-radar/research-relay.test.mjs
// Execute Apps Script source in an isolated VM with mocked Google services.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('./research-relay.gs',import.meta.url),'utf8');
function harness({secret='test-only-secret',http=200,body='{"code":"000000","data":[]}',onFetch=()=>{}}={}){
 const calls=[];
 const context=vm.createContext({
  PropertiesService:{getScriptProperties:()=>({getProperty:()=>secret})},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:(text)=>({setMimeType:()=>({getText:()=>text})})},
  UrlFetchApp:{fetch:(url,options)=>{calls.push({url,options});onFetch(url,options);return {getResponseCode:()=>http,getContentText:()=>body}}},
 });
 vm.runInContext(source,context);
 return {send:payload=>JSON.parse(context.doPost({postData:{contents:JSON.stringify(payload)}}).getText()),calls};
}
const good={key:'test-only-secret',endpoint:'aggTrades',symbol:'ALPHA_1156USDT',limit:100};
test('rejects invalid secret without calling upstream',()=>{
 const h=harness();assert.equal(h.send({...good,key:'bad'}).error,'unauthorized');assert.equal(h.calls.length,0);
});
test('rejects unsupported endpoint',()=>{
 const h=harness();assert.equal(h.send({...good,endpoint:'klines'}).error,'unsupported endpoint');assert.equal(h.calls.length,0);
});
test('rejects symbol injection',()=>{
 const h=harness();assert.equal(h.send({...good,symbol:'BTCUSDT&limit=1000'}).error,'invalid symbol');assert.equal(h.calls.length,0);
});
test('rejects oversized limit',()=>{
 const h=harness();assert.equal(h.send({...good,limit:1001}).error,'invalid limit');assert.equal(h.calls.length,0);
});
test('uses approved aggTrades endpoint and labels raw data unverified',()=>{
 const h=harness();const r=h.send(good);assert.equal(r.ok,true);assert.equal(r.validation,'RAW_UNVERIFIED');
 assert.match(h.calls[0].url,/\/agg-trades\?symbol=ALPHA_1156USDT&limit=100$/);
});
test('uses approved depth endpoint',()=>{
 const h=harness();const r=h.send({...good,endpoint:'depth'});assert.equal(r.ok,true);
 assert.match(h.calls[0].url,/\/fullDepth\?/);
});
test('returns upstream HTTP error without pretending success',()=>{
 const h=harness({http:429});assert.equal(h.send(good).error,'upstream_http_429');
});
test('rejects invalid JSON upstream',()=>{
 const h=harness({body:'not json'});assert.equal(h.send(good).error,'upstream_not_json');
});
