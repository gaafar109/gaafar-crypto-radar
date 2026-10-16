import {writeFile, appendFile} from 'node:fs/promises';
export function configFromExisting(settings, schedules, accountId) {
  const bindings=settings.bindings;
  if(!Array.isArray(bindings))throw Error('Existing Worker bindings unavailable');
  for(const name of ['BOT_TOKEN','OWNER_CHAT_ID','ALPHA_RELAY_SECRET']) {
    if(!bindings.some(b=>b.name===name&&['plain_text','secret_text'].includes(b.type)))throw Error('Missing existing setting: '+name);
  }
  if(bindings.some(b=>!['plain_text','secret_text','kv_namespace'].includes(b.type)))throw Error('Unsupported existing binding; manual review required');
  const state=bindings.find(b=>b.name==='STATE'&&b.type==='kv_namespace');
  if(!state||!state.namespace_id)throw Error('Existing STATE KV binding missing; refusing to deploy');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(settings.compatibility_date||''))throw Error('Existing compatibility date missing');
  const items=Array.isArray(schedules)?schedules:schedules?.schedules;
  if(!Array.isArray(items)||!items.length||items.some(x=>typeof x.cron!=='string'))throw Error('Existing schedules unavailable; refusing to deploy');
  return {name:'gaafarypto',main:'index.mjs',account_id:accountId,
    compatibility_date:settings.compatibility_date,
    compatibility_flags:settings.compatibility_flags||[],keep_vars:true,workers_dev:true,
    kv_namespaces:bindings.filter(b=>b.type==='kv_namespace').map(b=>({binding:b.name,id:b.namespace_id})),
    triggers:{crons:items.map(x=>x.cron)}};
}
export function credentials(env) {
  const account=String(env.CLOUDFLARE_ACCOUNT_ID||'').trim();
  const token=String(env.CLOUDFLARE_API_TOKEN||'').trim();
  if(!account)throw Error('CLOUDFLARE_ACCOUNT_ID is missing');
  if(!/^[a-f0-9]{32}$/i.test(account))throw Error('CLOUDFLARE_ACCOUNT_ID must contain exactly 32 hexadecimal characters; use the Account ID, not a URL or API token');
  if(!token)throw Error('CLOUDFLARE_API_TOKEN is missing');
  if(/[\s\x00-\x1f\x7f]/.test(token))throw Error('CLOUDFLARE_API_TOKEN contains internal whitespace or control characters; copy only the token');
  return {account,token};
}
async function main(){
  const {account,token}=credentials(process.env);
  if(process.env.GITHUB_ENV) {
    console.log('::add-mask::'+token);
    await appendFile(process.env.GITHUB_ENV,'CLOUDFLARE_ACCOUNT_ID='+account+'\nCLOUDFLARE_API_TOKEN='+token+'\n');
  }
  const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/gaafarypto';
  async function read(path){
    const r=await fetch(base+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw Error('Cloudflare configuration read failed: HTTP '+r.status);
    const b=await r.json();if(!b.success)throw Error('Cloudflare configuration read rejected');return b.result;
  }
  const settings=await read('/settings'), schedules=await read('/schedules');
  await writeFile(new URL('../wrangler.generated.json',import.meta.url),JSON.stringify(configFromExisting(settings,schedules,account),null,2));
  console.log('Prepared configuration using existing STATE binding, variables and schedules.');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
