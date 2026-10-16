import {writeFile} from 'node:fs/promises';
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
async function main(){
  const account=process.env.CLOUDFLARE_ACCOUNT_ID, token=process.env.CLOUDFLARE_API_TOKEN;
  if(!/^[a-f0-9]{32}$/i.test(account||'')||!token)throw Error('Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in GitHub Actions secrets');
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
