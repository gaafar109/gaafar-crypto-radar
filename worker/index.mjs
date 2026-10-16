// Gaafarypto v2. Paste this ENTIRE file into Cloudflare Edit Code.
// Keep STATE, BOT_TOKEN, OWNER_CHAT_ID. Add secret ALPHA_RELAY_SECRET.
// Set ONE cron: */5 * * * * . Alpha uses your authenticated Google connector.
// The next scheduled run registers Telegram's webhook automatically.
// Only the scheduler writes trading-observation state. Webhooks write a mailbox.
// KV is eventually consistent: queued setting changes can take an extra cycle.
// No exchange credentials, trading or artificial prices. Alpha source: Binance via Google.
const VERSION = '2026-10-16.2';
const BASE = 'https://gaafarypto.mohammed-gaafar.workers.dev';
const SPOTS = ['https://data-api.binance.vision', 'https://api.binance.com', 'https://api-gcp.binance.com'];
const ALPHA = 'https://www.binance.com/bapi/defi/v1/public/alpha-trade';
const RELAY_URL = 'https://script.google.com/macros/s/AKfycbwVG2jj-e3E9_F1ACQHb8ajnB6QpK4_LD6GGJ4B9Pg6ZS0ux98CyMcVsl1-G6RvhKmvHg/exec';
const WATCH = ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT'];
const FRAMES = {'15m':900000,'1h':3600000,'4h':14400000};
const fmt = n => Number(n).toPrecision(7);
const mean = a => a.reduce((x,y)=>x+y,0)/a.length;
const pairKey = (m,s) => m+':'+s;
const initial = () => ({frame:'15m',market:'both',paused:false,cursor:0,open:[],history:[],out:[],alerts:[],seen:{},errors:{},lastRun:null,meta:null,applied:[],members:[]});
function safe(env,e) {
  let s=String(e instanceof Error?e.message:e);
  for(const v of [env.BOT_TOKEN,env.ALPHA_RELAY_SECRET]) if(v) s=s.split(String(v).trim()).join('[REDACTED]');
  return s.replace(/bot\d+:[A-Za-z0-9_-]+/g,'bot[REDACTED]').slice(0,900);
}
function config(env) {
  if(!env.STATE||!String(env.BOT_TOKEN||'').trim()||!/^\d+$/.test(String(env.OWNER_CHAT_ID||'').trim())) throw Error('راجع STATE وBOT_TOKEN وOWNER_CHAT_ID');
}
async function load(env) {return Object.assign(initial(),await env.STATE.get('state','json')||{});}
function queue(s,t) {s.out.push(String(t).slice(0,4000));s.out=s.out.slice(-100);}
function broadcast(env,s,text) {
  const recipients=[...new Set([String(env.OWNER_CHAT_ID).trim(),...(s.members||[])])];
  for(const to of recipients)s.out.push({to,text:String(text).slice(0,4000)});
  s.out=s.out.slice(-100);
}
async function tg(env,method,payload) {
  const r=await fetch('https://api.telegram.org/bot'+String(env.BOT_TOKEN).trim()+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
  const b=await r.json();
  if(!r.ok||!b.ok) throw Error('Telegram '+r.status+': '+safe(env,b.description||'Unknown error'));
  return b.result;
}
const send=(env,text,to=String(env.OWNER_CHAT_ID).trim())=>tg(env,'sendMessage',{chat_id:String(to),text:String(text).slice(0,4000)});
async function hookSecret(env) {
  const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('gaafarypto-webhook-v2:'+String(env.BOT_TOKEN).trim()));
  return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
}
function same(a,b) {if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
async function register(env,s) {
  const secret=await hookSecret(env),id=VERSION+':'+secret;
  if(s.webhookID===id)return;
  await tg(env,'setWebhook',{url:BASE+'/telegram',secret_token:secret,allowed_updates:['message'],max_connections:1,drop_pending_updates:false});
  s.webhookID=id;
  queue(s,'تم تفعيل استقبال الأوامر فور وصولها — '+VERSION+'\nالتحليل والحالة يردان عادة خلال ثوانٍ. تغييرات الإعدادات تُحفظ بطلب وتُطبق عند دورة الفحص، وقد تتأخر دورة إضافية. الفحص التلقائي حسب Cron.');
}

export function rsi(v,n=14) {
  let g=0,l=0;
  for(let i=1;i<=n;i++){const d=v[i]-v[i-1];g+=Math.max(d,0)/n;l+=Math.max(-d,0)/n;}
  for(let i=n+1;i<v.length;i++){const d=v[i]-v[i-1];g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n;}
  return l?100-100/(1+g/l):g?100:50;
}
const ema=(a,n)=>a.slice(1).reduce((v,x)=>v+(x-v)*2/(n+1),a[0]);
export function analyze(rows,now=Date.now(),frame='15m') {
  const ms=FRAMES[frame];if(!ms||!Array.isArray(rows))throw Error('فريم أو بيانات غير صالحة');
  const a=rows.filter(r=>Array.isArray(r)&&+r[6]<now).map(r=>r.map(Number));
  if(a.length<60||now-a.at(-1)[6]>ms*2)throw Error('بيانات ناقصة أو متأخرة؛ لا تحليل');
  if(a.some((r,i)=>r.length<8||!r.slice(0,8).every(Number.isFinite)||r[3]<=0||r[4]<=0||r[2]<r[3]||r[4]>r[2]||r[4]<r[3]||r[5]<0||r[7]<0||(i>0&&r[0]-a[i-1][0]!==ms)))throw Error('بيانات شموع غير صالحة أو بها فجوات');
  const c=a.map(r=>r[4]),last=a.at(-1),price=last[4],rs=rsi(c);
  const tr=a.slice(1).map((r,i)=>Math.max(r[2]-r[3],Math.abs(r[2]-a[i][4]),Math.abs(r[3]-a[i][4])));
  const atr=mean(tr.slice(-14)),support=Math.min(...a.slice(-21,-1).map(r=>r[3])),resistance=Math.max(...a.slice(-21,-1).map(r=>r[2]));
  const signal=price>resistance&&price>ema(c,50)&&rs>=50&&rs<=72&&last[5]>mean(a.slice(-21,-1).map(r=>r[5]))*1.2&&last[7]>=50000&&atr>0&&atr/price<=0.08;
  const stop=Math.min(price-1.5*atr,support),risk=price-stop;
  if(stop<=0||risk<=0)throw Error('مستويات وقف غير صالحة');
  return {price,rs,atr,support,resistance,stop,targets:[1,2,3].map(x=>price+x*risk),entry2:resistance,signal,stamp:last[6],quoteVolume:last[7]};
}
class MarketError extends Error {constructor(message,status=0){super(message);this.status=status;}}
async function getJSON(url) {
  let r;try{r=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(7000)});}catch{throw new MarketError(new URL(url).host+': اتصال متعذر أو مهلة');}
  if(!r.ok){
    // No bypass for rate limiting, IP bans, or jurisdiction restrictions.
    const reason=r.status===403?'رفض وصول من المصدر؛ لا بيانات':r.status===451?'غير متاح قانونيًا من موقع التشغيل':r.status===429||r.status===418?'حظر/حد طلبات؛ أوقف إعادة المحاولات':'طلب مرفوض';
    let detail='';
    try {
      const raw=(await r.text()).slice(0,16000);
      detail=raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g,'[IP]').replace(/\s+/g,' ').trim().slice(0,420);
    }catch{}
    const server=String(r.headers.get('server')||'غير مذكور').slice(0,60);
    throw new MarketError(new URL(url).host+' HTTP '+r.status+' — '+reason+' | server: '+server+(detail?' | نص الرفض: '+detail:''),r.status);
  }
  let b;try{b=await r.json();}catch{throw new MarketError('رد المصدر ليس JSON صالحًا');}
  if(b.success===false||(b.code!==undefined&&b.code!=='000000'&&b.code!==0))throw new MarketError('رفض مصدر البيانات: '+String(b.msg||b.message||b.code).slice(0,150));
  return b;
}
// Per-invocation health memory: one blocked host is not retried for every pair.
async function relayAlpha(env,path) {
  const secret=String(env.ALPHA_RELAY_SECRET||'').trim();
  if(!secret)throw Error('أضف ALPHA_RELAY_SECRET في Cloudflare من مفتاح setupRelay؛ ليس توكن تليجرام');
  const url=new URL(ALPHA+path);
  let payload;
  if(url.pathname.endsWith('/get-exchange-info'))payload={key:secret,endpoint:'info'};
  else if(url.pathname.endsWith('/ticker'))payload={key:secret,endpoint:'ticker',symbol:url.searchParams.get('symbol')};
  else if(url.pathname.endsWith('/klines'))payload={key:secret,endpoint:'klines',symbol:url.searchParams.get('symbol'),interval:url.searchParams.get('interval'),limit:Number(url.searchParams.get('limit'))};
  else throw Error('طلب غير مدعوم في وصلة ألفا');
  let r;
  try {
    r=await fetch(RELAY_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'manual',signal:AbortSignal.timeout(20000)});
    // Google ContentService redirects to a one-time output URL. Never forward secrets.
    if([301,302,303,307,308].includes(r.status)){
      const location=r.headers.get('location');
      if(!location)throw Error('رد تحويل بدون رابط');
      const next=new URL(location,RELAY_URL);
      if(next.protocol!=='https:'||next.hostname!=='script.googleusercontent.com'||next.port||next.username||next.password||next.pathname!=='/macros/echo')throw Error('راجع نشر Google: Web app، Execute as Me، الوصول Anyone، ورابط /exec');
      r=await fetch(next.toString(),{method:'GET',redirect:'manual',signal:AbortSignal.timeout(20000)});
      if([301,302,303,307,308].includes(r.status))throw Error('وصلة Google أعادت تحويلًا إضافيًا؛ راجع نشر Web app والوصول Anyone');
    }
  }catch(e){throw Error('اتصال وصلة Google: '+safe(env,e));}
  if(!r.ok)throw Error('وصلة Google HTTP '+r.status+'؛ راجع النشر والصلاحيات');
  let b;try{b=await r.json();}catch{throw Error('وصلة Google لم تُرجع JSON؛ تحقق من نشر كود connector والوصول Anyone');}
  if(!b||b.ok!==true){
    if(b?.error==='Unauthorized')throw Error('مفتاح ALPHA_RELAY_SECRET لا يطابق مفتاح setupRelay');
    throw new MarketError('وصلة ألفا: '+safe(env,b?.error||'رد غير متوقع'),Number(b?.upstream_status)||0);
  }
  const fetched=Date.parse(b.fetched_at);
  if(!Number.isFinite(fetched)||Date.now()-fetched>180000||fetched-Date.now()>60000)throw Error('وصلة ألفا أعادت بيانات قديمة أو توقيتًا غير صالح');
  if(b.body?.code!=='000000'||b.body?.success===false)throw Error('رد Binance عبر الوصلة غير صالح');
  return b.body;
}
export async function diagnoseSpot() {
  const host='https://data-api.binance.vision';
  const lines=['فحص Binance Spot — مصدر بيانات السوق الرسمي', 'المصدر: '+host];
  try {
    const rows=await getJSON(host+'/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=100');
    const a=analyze(rows,Date.now(),'15m');
    lines.push('شموع BTCUSDT: نجحت', 'آخر إغلاق: '+fmt(a.price), 'وقت الإغلاق UTC: '+new Date(a.stamp).toISOString());
    const p=await getJSON(host+'/api/v3/ticker/price?symbol=BTCUSDT');
    if(p?.symbol!=='BTCUSDT'||!Number.isFinite(+p.price)||+p.price<=0)throw Error('سعر غير صالح');
    lines.push('آخر سعر تداول: '+fmt(p.price)+' USDT', 'السعر والشموع نجحا؛ لا يثبت تنفيذ صفقات.');
  } catch(e) {lines.push('فشل المصدر: '+e.message);}
  return lines.join('\n');
}

function sourceClient(env) {
  const failed=new Map();let chosen=null,spotBlocked=null;
  async function spot(path) {
    if(spotBlocked)throw spotBlocked;
    const errors=[];
    const hosts=chosen?[chosen,...SPOTS.filter(x=>x!==chosen)]:SPOTS;
    for(const host of hosts){
      if(failed.has(host)){errors.push(failed.get(host));continue;}
      try{const b=await getJSON(host+path);chosen=host;return b;}
      catch(e){if([418,429,451].includes(e.status)){spotBlocked=new MarketError([...errors,e.message].join(' | '),e.status);throw spotBlocked;}if(e.status===400)throw e;failed.set(host,e.message);errors.push(e.message);}
    }
    throw Error('سبوت غير متاح من الاستضافة: '+errors.join(' | '));
  }
  let alphaFailure=null;
  async function alpha(path){if(alphaFailure)throw Error(alphaFailure);try{return await relayAlpha(env,path);}catch(e){alphaFailure=e.message;throw e;}}
  return {
    async candles(m,s,f='15m',limit=100){
      const p=new URLSearchParams({symbol:s,interval:f,limit:String(limit)});
      const b=m==='spot'?await spot('/api/v3/klines?'+p):await alpha('/klines?'+p);
      const a=m==='spot'?b:b.data;if(!Array.isArray(a))throw Error('استجابة شموع غير متوقعة');return a;
    },
    async ticker(m,s) {
      const b=m==='spot'?await spot('/api/v3/ticker/price?symbol='+encodeURIComponent(s)):await alpha('/ticker?symbol='+encodeURIComponent(s));
      const d=m==='spot'?b:b.data, p=Number(m==='spot'?d?.price:d?.lastPrice);
      if(d?.symbol!==s||!Number.isFinite(p)||p<=0)throw Error('سعر غير صالح');
      return {price:p,fetchedAt:new Date().toISOString()};
    },
    async info(){const b=await alpha('/get-exchange-info');if(!Array.isArray(b.data?.symbols))throw Error('قائمة ألفا غير صالحة');return b.data.symbols;},
    get selected(){return chosen;}
  };
}
function describe(m,s,a) {
  const levels=a.signal?`\nدخول مرجعي: ${fmt(a.price)}\nمستوى إعادة اختبار بعد الاختراق: ${fmt(a.entry2)}؛ دخول مشروط بتأكيد جديد غير منفذ\nوقف أولي: ${fmt(a.stop)}\nأهداف: ${a.targets.map(fmt).join(' / ')}`:'\nلا إشارة دخول الآن؛ لن تُعرض أهداف ووقف كخطة صفقة حتى تتحقق الشروط.';
  return `${a.signal?'🔔 شروط إشارة تجريبية متحققة':'📊 تحليل؛ شروط الإشارة غير متحققة'} ${m.toUpperCase()} ${s}\nآخر إغلاق: ${fmt(a.price)} USDT\nRSI: ${a.rs.toFixed(1)}\nدعم: ${fmt(a.support)}\nمقاومة: ${fmt(a.resistance)}${levels}\nحجم الشمعة USDT: ${fmt(a.quoteVolume)}\nوقت الإغلاق UTC: ${new Date(a.stamp).toISOString()}\nقواعد تجريبية؛ لا تنفيذ أو ضمان ربح. الدخول الثاني غير محسوب في المتابعة. الحجم لا يثبت سيولة دفتر الأوامر.`;
}
const HELP=`Gaafarypto — Spot وAlpha\n/price ALPHA_1156USDT alpha — لقطة آخر سعر تداول\n/status حالة التشغيل\n/diagnosespot فحص مصدر سبوت الرسمي\n/diagnose فحص اتصال ألفا\n/analyze BTCUSDT spot\n/analyze ALPHA_175USDT alpha\n/frame 15m أو 1h أو 4h\n/market both أو spot أو alpha\n/pause إيقاف إشارات جديدة\n/resume استئناف\n/history نتائج رصد الشموع\n/alert BTCUSDT spot 100000 above\n/alerts قائمة التنبيهات\n/clearalerts حذف التنبيهات\nالتحليل والحالة مباشرة عبر Webhook. تغييرات الإعدادات والتنبيهات تُطبق بدورة الفحص بعد رسالة تأكيد، وقد تتأخر دورة إضافية.\nلا تداول تلقائي ولا فلتر شرعي.`;
function parse(text){const [raw='',...args]=String(text||'').trim().split(/\s+/);return {cmd:raw.split('@')[0].toLowerCase(),args};}
function mutation(cmd,args) {
  if(cmd==='/adduser'||cmd==='/removeuser'){
    if(!/^\d{1,20}$/.test(args[0]||''))throw Error('الصيغة '+cmd+' ثم رقم حساب تليجرام؛ ليس رقم الهاتف');
    return {cmd,args:[args[0]]};
  }
  if(cmd==='/pause'||cmd==='/resume'||cmd==='/clearalerts')return {cmd,args:[]};
  if(cmd==='/frame'){if(!Object.hasOwn(FRAMES,args[0]))throw Error('استخدم /frame 15m أو 1h أو 4h');return {cmd,args:[args[0]]};}
  if(cmd==='/market'){if(!['spot','alpha','both'].includes(args[0]))throw Error('استخدم /market both أو spot أو alpha');return {cmd,args:[args[0]]};}
  if(cmd==='/alert'){
    const [s='',m,p,d]=args;
    if(!/^[A-Z0-9_]{3,40}$/.test(s)||!['spot','alpha'].includes(m)||!Number.isFinite(+p)||+p<=0||!['above','below'].includes(d))throw Error('الصيغة /alert BTCUSDT spot 100000 above');
    return {cmd,args:[s,m,String(+p),d]};
  }
  return null;
}
async function reply(env,text,viewer=String(env.OWNER_CHAT_ID).trim()) {
  const {cmd,args}=parse(text),s=await load(env);
  const owner=viewer===String(env.OWNER_CHAT_ID).trim();
  if(cmd==='/users')return owner?'المستخدمون المضافون: '+((s.members||[]).join(' / ')||'لا يوجد')+'\nالحد الحالي 5 أشخاص غير المالك.':'إدارة المستخدمين للمالك فقط.';
  if(cmd==='/start'||cmd==='/help')return owner?HELP+'\n/adduser رقم المستخدم — السماح لشخص\n/removeuser رقم المستخدم — إلغاء السماح\n/users قائمة الأشخاص\n/id رقم حسابك\nالأشخاص المضافون يطلبون تحليلًا ويستقبلون الإشارات القادمة فقط. الإعدادات والتنبيهات السعرية الشخصية للمالك.':'Gaafarypto — تم السماح لحسابك.\n/analyze BTCUSDT spot\n/analyze ALPHA_1156USDT alpha\n/status حالة الفحص\n/history نتائج الرصد\n/id رقم حسابك\nتستقبل الإشارات الجديدة والمتابعة. التحكم في الإعدادات للمالك. لا شراء أو بيع فعلي ولا ضمان أرباح.';
  if(!owner&&!['/status','/history','/analyze','/price'].includes(cmd))return 'الأمر للمالك فقط. المتاح لك: /analyze و/status و/history و/id';
  if(cmd==='/diagnosespot')return await diagnoseSpot();
  if(cmd==='/diagnose') {
    const lines=['فحص وصلة ألفا — '+VERSION,'المصدر: Binance Alpha عبر وصلة Google الخاصة بك.'];
    try {
      const src=sourceClient(env),symbols=await src.info();
      const available=symbols.filter(x=>x.quoteAsset==='USDT'&&x.status==='TRADING');
      lines.push('قائمة ألفا: نجحت. أزواج USDT: '+available.length);
      if(available.length){
        const symbol=available[0].symbol;
        const a=analyze(await src.candles('alpha',symbol,'15m'),Date.now(),'15m');
        lines.push('شموع '+symbol+': نجحت. آخر إغلاق UTC: '+new Date(a.stamp).toISOString());
      }
    }catch(e){lines.push('فشل اختبار ألفا: '+safe(env,e),'نتيجة الفحص لا تثبت السبب إن كان نص الرفض عامًا. لا تغيير للتوكن مطلوب.');}
    return lines.join('\n');
  }
  if(cmd==='/status')return `الإصدار: ${VERSION}\nاستقبال الأوامر: Webhook\nالفريم المطبق: ${s.frame}\nالسوق: ${s.market}\nالفحص: ${s.paused?'متوقف':'مفعّل'}\nآخر اكتمال UTC: ${s.lastRun||'لم يكتمل بعد'}\nمتابعة: ${s.open.length}/6\nمصدر سبوت آخر دورة: ${s.spotSource||'لم ينجح بعد'}\nأخطاء آخر دورة: ${JSON.stringify(s.errors)}\nالتخزين قد يتأخر في عرض آخر حالة. الفحص حسب Cron؛ سبوت 4 أزواج وألفا زوجان بالتناوب. الرد السريع لا يثبت اتصال بيانات السوق.`;
  if(cmd==='/history')return s.history.length?s.history.slice(-10).map(x=>`${x.symbol}: ${x.result} | ${x.time}`).join('\n'):'لا نتائج رصد بعد. لا احتساب أرباح أو رسوم أو تنفيذ.';
  if(cmd==='/alerts')return s.alerts.length?s.alerts.map(a=>`${a.symbol} ${a.market} ${a.direction} ${a.price}`).join('\n'):'لا تنبيهات مطبقة حاليًا.';
  if(cmd==='/price'){
    const symbol=(args[0]||'').toUpperCase(),market=args[1]||'alpha';
    if(!/^[A-Z0-9_]{3,40}$/.test(symbol)||!['spot','alpha'].includes(market))throw Error('الصيغة /price ALPHA_1156USDT alpha');
    const p=await sourceClient(env).ticker(market,symbol);
    return symbol+'\nآخر سعر تداول من المصدر: '+fmt(p.price)+' USDT\nوقت الجلب UTC: '+p.fetchedAt+'\nلقطة عند الطلب، وليست بثًا مستمرًا أو سعر تنفيذ مضمونًا.';
  }
  if(cmd==='/analyze'){
    const symbol=(args[0]||'').toUpperCase(),market=args[1]||'spot';
    if(!/^[A-Z0-9_]{3,40}$/.test(symbol)||!['spot','alpha'].includes(market))throw Error('الصيغة /analyze BTCUSDT spot أو /analyze ALPHA_175USDT alpha');
    const src=sourceClient(env);
    const a=analyze(await src.candles(market,symbol,s.frame),Date.now(),s.frame);
    let live;
    try{const p=await src.ticker(market,symbol);live='آخر سعر تداول من المصدر: '+fmt(p.price)+' USDT\nوقت جلب السعر UTC: '+p.fetchedAt;}
    catch(e){live='السعر الحالي غير متاح: '+safe(env,e);}
    return live+'\nلقطة عند الطلب؛ مستويات التحليل محسوبة على الشموع المغلقة.\n'+describe(market,symbol,a);
  }
  return HELP;
}
async function webhook(request,env) {
  config(env);
  if(request.method!=='POST')return new Response('Method not allowed',{status:405});
  const expected=await hookSecret(env);
  if(!same(request.headers.get('X-Telegram-Bot-Api-Secret-Token')||'',expected))return new Response('Forbidden',{status:403});
  if(Number(request.headers.get('content-length')||0)>65536)return new Response('Too large',{status:413});
  let u;try{u=await request.json();}catch{return new Response('Invalid JSON',{status:400});}
  const msg=u.message;
  if(!Number.isSafeInteger(u.update_id)||!msg||msg.chat?.type!=='private')return new Response('OK');
  if(typeof msg.text!=='string')return new Response('OK');
  const viewer=String(msg.chat.id),owner=viewer===String(env.OWNER_CHAT_ID).trim();
  const parsed=parse(msg.text),access=owner||(await load(env)).members.includes(viewer);
  // No scanning, settings changes or signals for people who are not approved.
  if(!access||parsed.cmd==='/id'){
    if(parsed.cmd==='/start'||parsed.cmd==='/id')try{
      await send(env,'رقم حسابك: '+viewer+(access?'':'\nالبوت يحتاج موافقة صاحبه. ابعت له الرقم ليضيف حسابك، وبعد الموافقة ابعت /start مرة أخرى.'),viewer);
    }catch{}
    return new Response('OK');
  }
  // KV deduplication is best-effort, not an exactly-once guarantee.
  const done='done:'+u.update_id;
  if(await env.STATE.get(done))return new Response('OK');
  try {
    const {cmd,args}=parsed;
    // The owner check MUST precede parsing/persisting a mutating command.
    const m=owner?mutation(cmd,args):null;
    if(m){
      const id=String(u.update_id).padStart(16,'0');
      await env.STATE.put('inbox:'+id,JSON.stringify({...m,id}),{expirationTtl:86400});
      await send(env,'تم استلام الطلب '+cmd+'؛ سيُطبق عند دورة الفحص، وقد يتأخر دورة إضافية. ستصلك رسالة بعد التطبيق.');
    }else await send(env,await reply(env,msg.text,viewer),viewer);
  }catch(e){
    console.error('Command error',{error:safe(env,e)});
    // If Telegram delivery fails, return 503 so Telegram can retry.
    try{await send(env,'تعذّر الطلب: '+safe(env,e),viewer);}catch{return new Response('Retry',{status:503});}
  }
  await env.STATE.put(done,'1',{expirationTtl:86400});
  return new Response('OK');
}
function apply(s,m,env) {
  if(m.cmd==='/adduser'){
    const id=m.args[0];
    if(id===String(env.OWNER_CHAT_ID).trim())return 'حساب المالك مسموح بالفعل.';
    if(s.members.includes(id))return 'هذا الحساب مضاف بالفعل.';
    if(s.members.length>=5)return 'لم يُضف الحساب: الحد الحالي 5 أشخاص للحفاظ على حدود التشغيل. احذف شخصًا أولًا.';
    s.members.push(id);return 'تم السماح للحساب '+id+'. يرسل /start للبوت. يستقبل الإشارات الجديدة ويمكنه طلب تحليل. الإعدادات تحت تحكمك.';
  }
  if(m.cmd==='/removeuser'){
    const id=m.args[0];s.members=s.members.filter(x=>x!==id);
    s.out=s.out.filter(x=>typeof x==='string'||x.to!==id);
    return 'تم إلغاء السماح للحساب '+id+' وإزالة رسائله المنتظرة.';
  }
  if(m.cmd==='/pause'){s.paused=true;return 'تم تطبيق إيقاف الإشارات الجديدة. المتابعة وتنبيهات السعر مستمرة.';}
  if(m.cmd==='/resume'){s.paused=false;return 'تم تطبيق استئناف الفحص.';}
  if(m.cmd==='/frame'){s.frame=m.args[0];return 'تم تطبيق الفريم: '+s.frame;}
  if(m.cmd==='/market'){s.market=m.args[0];return 'تم تطبيق السوق: '+s.market;}
  if(m.cmd==='/clearalerts'){s.alerts=[];return 'تم مسح التنبيهات.';}
  if(m.cmd==='/alert'){
    if(s.alerts.length>=4)return 'لم يُضف التنبيه: الحد 4 تنبيهات.';
    const [symbol,market,p,direction]=m.args;s.alerts.push({symbol,market,price:+p,direction});
    return 'تم تطبيق تنبيه '+symbol+'. يعتمد على آخر إغلاق دقيقة عند كل دورة فحص؛ قد يفوت لمس السعر بين الإغلاقات.';
  }
  return 'طلب غير معروف.';
}
export function advance(t,rows,now=Date.now()) {
  const bars=rows.filter(r=>+r[0]>t.last&&+r[6]<now).map(r=>r.map(Number));
  if(!bars.length){if(now-t.last>100*60000)return 'انقطاع متابعة طويل؛ النتيجة غير محسومة';return null;}
  for(const b of bars){
    if(b[0]-t.last!==60000||![b[0],b[2],b[3],b[4],b[6]].every(Number.isFinite)||b[3]<=0||b[2]<b[3]||b[4]<b[3]||b[4]>b[2])return 'فجوة/بيانات غير صالحة؛ النتيجة غير محسومة';
    t.last=b[0];
    if(b[3]<=t.stop)return `رصد الوقف ${fmt(t.stop)}؛ أهداف سابقة ${t.hit}/3، دون تنفيذ أو رسوم`;
    while(t.hit<3&&b[2]>=t.targets[t.hit])t.hit++;
    if(t.hit===3)return 'رصد الأهداف الثلاثة؛ لا يثبت تنفيذ صفقة';
    t.stop=Math.max(t.stop,b[4]-2*t.atr);
  }
  return null;
}
async function track(s,src,env) {
  for(const t of [...s.open])try{
    const result=advance(t,await src.candles(t.market,t.symbol,'1m',100));
    if(result){s.history.push({id:t.id,market:t.market,symbol:t.symbol,result,time:new Date().toISOString()});s.history=s.history.slice(-100);s.open=s.open.filter(x=>x.id!==t.id);broadcast(env,s,'متابعة '+t.symbol+'\n'+result);}
  }catch(e){s.errors[pairKey(t.market,t.symbol)]=e.message;}
}
async function prices(s,src) {
  for(const a of [...s.alerts])try{
    const r=(await src.candles(a.market,a.symbol,'1m',5)).filter(x=>+x[6]<Date.now()).at(-1);
    if(!r||Date.now()-+r[6]>180000||!Number.isFinite(+r[4])||+r[4]<=0)throw Error('سعر ناقص أو متأخر');
    if(a.direction==='above'?+r[4]>=a.price:+r[4]<=a.price){queue(s,`🔔 ${a.symbol} آخر إغلاق دقيقة: ${fmt(r[4])}\nشرط ${a.direction} ${a.price}`);s.alerts=s.alerts.filter(x=>x!==a);}
  }catch(e){s.errors['price:'+a.symbol]=e.message;}
}
async function scan(s,src,env) {
  const pairs=s.market==='alpha'?[]:WATCH.map(x=>['spot',x]);
  if(s.market!=='spot')try{
    if(!s.meta||Date.now()-s.meta.time>86400000)s.meta={time:Date.now(),symbols:(await src.info()).filter(x=>x.quoteAsset==='USDT'&&x.status==='TRADING').map(x=>x.symbol)};
    const list=s.meta.symbols;if(!list.length)throw Error('لا أزواج ألفا متاحة');
    const count=Math.min(2,list.length);for(let i=0;i<count;i++)pairs.push(['alpha',list[(s.cursor+i)%list.length]]);s.cursor=(s.cursor+count)%list.length;
  }catch(e){s.errors.alpha=e.message;}
  for(const [market,symbol] of pairs)try{
    const a=analyze(await src.candles(market,symbol,s.frame),Date.now(),s.frame),k=pairKey(market,symbol);
    if(!a.signal||s.seen[k]===a.stamp||s.open.length>=6||s.open.some(t=>pairKey(t.market,t.symbol)===k))continue;
    s.seen[k]=a.stamp;const id=symbol+'-'+Date.now();
    s.open.push({id,market,symbol,atr:a.atr,stop:a.stop,targets:a.targets,hit:0,last:Math.floor(Date.now()/60000)*60000});
    broadcast(env,s,describe(market,symbol,a)+'\nمعرّف: '+id+'\nمتابعة من أول دقيقة كاملة تالية، بوقف متحرك. ليست قياسًا للربحية.');
  }catch(e){s.errors[pairKey(market,symbol)]=e.message;}
  const keys=Object.keys(s.seen);keys.slice(0,Math.max(0,keys.length-500)).forEach(k=>delete s.seen[k]);
}
async function deliver(env,s) {
  for(let i=0;i<8&&s.out.length;i++){
    const item=s.out[0],shared=typeof item!=='string',to=shared?item.to:String(env.OWNER_CHAT_ID).trim();
    if(shared&&to!==String(env.OWNER_CHAT_ID).trim()&&!s.members.includes(to)){s.out.shift();continue;}
    try{await send(env,shared?item.text:item,to);s.out.shift();}
    catch(e){
      s.errors.delivery=safe(env,e);
      // A blocked/deleted guest must not prevent delivery to the owner or others.
      if(to!==String(env.OWNER_CHAT_ID).trim()&&/^Telegram (400|403):/.test(e.message)){s.out.shift();continue;}
      break;
    }
  }
}
export async function run(env) {
  config(env);const s=await load(env);s.errors={};s.applied=s.applied||[];
  try{await register(env,s);}catch(e){s.errors.webhook=safe(env,e);console.error('Webhook registration failed',{error:s.errors.webhook});}
  const batch=await env.STATE.list({prefix:'inbox:',limit:3}),remove=[];
  for(const k of batch.keys){
    const m=await env.STATE.get(k.name,'json');if(!m)continue;
    if(!s.applied.includes(m.id)){queue(s,apply(s,m,env));s.applied.push(m.id);}
    remove.push(k.name);
  }
  s.applied=s.applied.slice(-300);
  const src=sourceClient(env);
  await track(s,src,env);await prices(s,src);if(!s.paused)await scan(s,src,env);
  s.spotSource=src.selected;s.lastRun=new Date().toISOString();
  if(Object.keys(s.errors).length)console.error('Market/delivery errors',{errors:s.errors});
  await deliver(env,s);
  // Save before deleting mailbox entries. A crash can repeat a sent message.
  await env.STATE.put('state',JSON.stringify(s));
  for(const k of remove)await env.STATE.delete(k);
  console.log('Gaafarypto cycle finished',{version:VERSION,errors:s.errors,pending:s.out.length});
}
export default {
  async scheduled(event,env,ctx){ctx.waitUntil(run(env).catch(e=>{console.error('Cycle failed',{error:safe(env,e)});throw Error(safe(env,e));}));},
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    if(path==='/telegram')try{return await webhook(request,env);}catch(e){console.error('Webhook failed',{error:safe(env,e)});return new Response('Retry',{status:503});}
    if(path!=='/')return new Response('Not found',{status:404});
    return new Response('Gaafarypto '+VERSION+' installed. Public page does not verify market data, webhook or scheduling. Check /status in Telegram.',{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
  }
};
