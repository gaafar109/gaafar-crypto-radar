import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configFromExisting, credentials} from './prepare-config.mjs';
const settings={compatibility_date:'2026-10-15',bindings:[{type:'kv_namespace',name:'STATE',namespace_id:'existing-kv'},...['BOT_TOKEN','OWNER_CHAT_ID','ALPHA_RELAY_SECRET'].map(name=>({type:'secret_text',name}))]};
test('preserves existing storage identity and exact cron schedule without copying secrets',()=>{
  const c=configFromExisting(settings,{schedules:[{cron:'*/5 * * * *'}]},'account');
  assert.deepEqual(c.kv_namespaces,[{binding:'STATE',id:'existing-kv'}]);
  assert.deepEqual(c.triggers.crons,['*/5 * * * *']);
  assert.equal(c.keep_vars,true);assert.equal(c.vars,undefined);
});
test('refuses deployment without existing storage, required settings or schedule',()=>{
  assert.throws(()=>configFromExisting({...settings,bindings:settings.bindings.slice(1)},[], 'a'));
  assert.throws(()=>configFromExisting({...settings,bindings:settings.bindings.slice(0,1)},[{cron:'* * * * *'}], 'a'));
  assert.throws(()=>configFromExisting(settings,[], 'a'));
});
test('refuses unfamiliar bindings rather than removing them',()=>{
  assert.throws(()=>configFromExisting({...settings,bindings:[...settings.bindings,{name:'DB',type:'d1'}]},[{cron:'*/5 * * * *'}],'a'));
});

test('normalizes copied whitespace and diagnoses invalid inputs without disclosing values',()=>{
  const account='a'.repeat(32);
  assert.deepEqual(credentials({CLOUDFLARE_ACCOUNT_ID:' '+account+'\n',CLOUDFLARE_API_TOKEN:' token-example\n'}),{account,token:'token-example'});
  assert.throws(()=>credentials({CLOUDFLARE_ACCOUNT_ID:'wrong-value',CLOUDFLARE_API_TOKEN:'token-example'}),/CLOUDFLARE_ACCOUNT_ID must/);
  assert.throws(()=>credentials({CLOUDFLARE_ACCOUNT_ID:account}),/CLOUDFLARE_API_TOKEN is missing/);
  assert.throws(()=>credentials({CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:'abc\ndef'}),/internal whitespace/);
});
