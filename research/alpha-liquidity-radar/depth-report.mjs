import fs from 'node:fs';
import {depthMetrics} from './microstructure.mjs';
const out=[];
for(const f of fs.readdirSync('data').filter(x=>x.endsWith('-depth.json'))){
 const r=JSON.parse(fs.readFileSync('data/'+f)),d=r.body?.data;const rec={symbol:r.symbol,fetchedAt:r.fetchedAt,status:'unavailable',error:r.error??r.body?.message??null};
 try{if(!d)throw Error(rec.error??'empty source');Object.assign(rec,depthMetrics({timestamp:Number(d.T??d.E??r.fetchedAt),bids:d.bids,asks:d.asks},{now:r.fetchedAt,maxAgeMs:30000}));rec.status='snapshot_only';rec.error=null;}catch(e){rec.error=String(e);}
 out.push(rec);
}
fs.writeFileSync('data/depth.json',JSON.stringify(out,null,2));console.log(out.length,out.filter(x=>x.status==='snapshot_only').length);
