import test from 'node:test';
import assert from 'node:assert/strict';
import {accelerationWarnings,higherCloses,enhancedConfirmations} from './signal-variants.mjs';
const bars=(n=120)=>Array.from({length:n},(_,i)=>[i*60000,1,1.005,.995,1,100,i*60000+59999,100]);
test('acceleration uses strictly prior windows and quiet current price',()=>{
 const a=bars();for(let i=45;i<48;i++)a[i][7]=400;a[48][7]=1000;
 const w=accelerationWarnings(a);const x=w.find(x=>x.index===48);assert.equal(x.warning,true);assert.equal(x.volumeAcceleration,400/175);
 a[48][4]=1.03;a[48][2]=1.04;assert.equal(accelerationWarnings(a).find(x=>x.index===48).warning,false);
});
test('acceleration exact prefix invariance',()=>{
 const a=bars();a[80][7]=1000;
 assert.deepEqual(accelerationWarnings(a.slice(0,85)),accelerationWarnings(a).filter(w=>w.index<85));
});
test('higher aggregation is epoch anchored and rejects incomplete groups',()=>{
 const a=bars(12);assert.deepEqual(higherCloses(a,a[6][6]).map(x=>x.closeTime),[239999]);
 assert.equal(higherCloses(a.slice(1),a[11][6]).length,2);
 const b=bars(12);b.splice(5,1);assert.deepEqual(higherCloses(b,719999).map(x=>x.openTime),[0,480000]);
});
test('enhanced confirmation requires prior volume and rising closed higher frame',()=>{
 const a=bars();for(let i=0;i<a.length;i++){const p=1+i*.0002;a[i][1]=p;a[i][2]=p+.002;a[i][3]=p-.002;a[i][4]=p;}
 a[99][4]=1.04;a[99][2]=1.041;a[99][7]=200;
 const w=[{index:96,warning:true}];const s=enhancedConfirmations(a,w);assert.equal(s.length,1);assert.equal(s[0].entryIndex,100);assert.equal(s[0].warningIndex,96);assert.ok(s[0].higherClose>s[0].higherEMA20);
 a[99][7]=10;assert.equal(enhancedConfirmations(a,w).length,0);
});
test('enhanced confirmation exact prefix invariance and no future higher close',()=>{
 const a=bars();for(let i=0;i<a.length;i++){const p=1+i*.0002;a[i][1]=p;a[i][2]=p+.002;a[i][3]=p-.002;a[i][4]=p;}
 a[99][4]=1.04;a[99][2]=1.041;a[99][7]=200;
 const w=[{index:96,warning:true}];assert.deepEqual(enhancedConfirmations(a.slice(0,105),w),enhancedConfirmations(a,w).filter(s=>s.entryIndex<105));
 const original=enhancedConfirmations(a,w);a[110][4]=2;a[110][2]=2;assert.deepEqual(enhancedConfirmations(a,w),original);
});
test('insufficient higher history cannot confirm',()=>{
 const a=bars(70);a[60][4]=1.04;a[60][2]=1.04;assert.equal(enhancedConfirmations(a,[{index:58,warning:true}]).length,0);
});
