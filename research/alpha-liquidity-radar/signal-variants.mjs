// Preregistered research variants; no probability calibration or live execution.
import {computeWarnings,confirmWarnings} from './liquidity.mjs';
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
/** All acceleration windows precede the warning candle. Price-change ceiling is
 * absolute, so a large falling candle is not classified as quiet accumulation.
 * Acceleration threshold 1.5 is fixed before evaluation, not fitted here. */
export function accelerationWarnings(rows,opts={}){
 const threshold=opts.accelerationMin??1.5;
 if(typeof threshold!=='number'||!Number.isFinite(threshold)||threshold<=0)throw new RangeError('accelerationMin');
 return computeWarnings(rows,{...opts,volRatio:2,compressionMax:.07}).map(w=>{
  if(w.index<12)return {...w,warning:false,volumeAcceleration:null,barPriceChange:null};
  const prior=rows.slice(w.index-12,w.index).map(r=>Number(r[7])),baseline=mean(prior),recent=mean(prior.slice(-3));
  const volumeAcceleration=baseline>0?recent/baseline:null;
  const barPriceChange=Number(rows[w.index][4])/Number(rows[w.index-1][4])-1;
  return {...w,volumeAcceleration,barPriceChange,warning:w.warning&&volumeAcceleration!==null&&volumeAcceleration>=threshold&&Math.abs(barPriceChange)<=.02};
 });
}
/** Build epoch-anchored higher bars from complete contiguous groups only.
 * cutoffClose is inclusive: a higher bar closing with the confirmation bar is
 * observable after that bar closes, before the next-open entry. */
export function higherCloses(rows,cutoffClose,factor=4){
 if(!Number.isInteger(factor)||factor<2||!Number.isFinite(cutoffClose))throw new RangeError('factor or cutoffClose');
 if(!rows.length)return [];
 const ms=Number(rows[0][6])-Number(rows[0][0])+1;
 if(!Number.isInteger(ms)||ms<=0)throw new Error('invalid interval');
 const groupMs=ms*factor,groups=new Map();let previous=-Infinity;
 for(const r of rows){
  const t=Number(r[0]),end=Number(r[6]),close=Number(r[4]);
  if(!Number.isFinite(t)||!Number.isFinite(end)||!Number.isFinite(close)||close<=0||t<=previous||end-t+1!==ms)throw new Error('invalid higher-frame source');
  previous=t;if(end>cutoffClose)break;
  const bucket=Math.floor(t/groupMs)*groupMs;
  if(!groups.has(bucket))groups.set(bucket,[]);groups.get(bucket).push({t,end,close});
 }
 const out=[];
 for(const [start,bars] of groups){
  if(bars.length!==factor||bars.some((b,i)=>b.t!==start+i*ms||b.end!==start+(i+1)*ms-1))continue;
  out.push({openTime:start,closeTime:start+groupMs-1,close:bars.at(-1).close});
 }
 return out;
}
export function enhancedConfirmations(rows,warnings,opts={}){
 const factor=opts.higherFactor??4;if(!Number.isInteger(factor)||factor<2)throw new RangeError('higherFactor');
 const candidates=confirmWarnings(rows,warnings,opts),out=[];
 for(const s of candidates){
  const j=s.confirmIndex;if(j<20)continue;
  const history=rows.slice(j-20,j),volumeMean=mean(history.map(r=>Number(r[7])));
  if(Number(rows[j][7])<volumeMean)continue;
  const higher=higherCloses(rows,Number(rows[j][6]),factor);
  if(higher.length<20)continue;
  // EMA resets after missing higher groups; never bridge a data outage silently.
  const ms=(Number(rows[0][6])-Number(rows[0][0])+1)*factor;
  let start=higher.length-1;
  while(start>0&&higher[start].openTime-higher[start-1].openTime===ms)start--;
  const segment=higher.slice(start);if(segment.length<20)continue;
  const ema20=segment.slice(1).reduce((e,b)=>e+(b.close-e)*2/21,segment[0].close);
  if(segment.at(-1).close>ema20)out.push({...s,confirmationQuoteVolume:Number(rows[j][7]),trailingQuoteVolumeMean:volumeMean,higherClose:segment.at(-1).close,higherEMA20:ema20,higherFrameFactor:factor});
 }
 return out;
}
