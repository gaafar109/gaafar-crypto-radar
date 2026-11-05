"""Resumable public Alpha collector. Run from repository parent with a data directory.
No credentials, orders, deployment or access-control circumvention.
"""
import concurrent.futures,gzip,hashlib,json,pathlib,threading,time,urllib.request,urllib.error
ROOT=pathlib.Path('data');ROOT.mkdir(exist_ok=True);(ROOT/'raw').mkdir(exist_ok=True)
BASE='https://www.binance.com';halt=threading.Event();gate=threading.Lock();last=0
FRAMES={'4h':14400000,'1h':3600000,'15m':900000,'5m':300000}
def write(p,x):
 tmp=p.with_suffix(p.suffix+'.tmp');tmp.write_text(json.dumps(x));tmp.replace(p)
def get(path):
 global last
 dest=ROOT/'raw'/(hashlib.sha256(path.encode()).hexdigest()+'.json.gz')
 if dest.exists():
  with gzip.open(dest,'rt') as f:return json.load(f)['body']
 for retry in range(3):
  if halt.is_set():raise RuntimeError('collection halted after access/rate-limit response')
  with gate:
   delay=max(0,.25-(time.monotonic()-last))
   if delay:time.sleep(delay)
   last=time.monotonic()
  try:
   req=urllib.request.Request(BASE+path,headers={'Accept':'application/json'})
   with urllib.request.urlopen(req,timeout=20) as r:body=json.load(r)
   with gzip.open(dest,'wt') as f:json.dump({'url':BASE+path,'fetchedAtUTC':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'body':body},f)
   return body
  except urllib.error.HTTPError as e:
   if e.code in (403,418,429,451):halt.set();raise
   if e.code<500:raise
  except (TimeoutError,OSError):
   if retry==2:raise
  time.sleep(2**retry)
 raise RuntimeError('retries exhausted')
def collect(job):
 s,frame=job; p=ROOT/(s['symbol']+'-'+frame+'.json')
 if p.exists():return json.loads(p.read_text())
 rec={'symbol':s['symbol'],'status':s['status'],'frame':frame,'requestedStart':START,'requestedEnd':END,'rows':[],'error':None,'paginationComplete':False}
 try:
  url=f"/bapi/defi/v1/public/alpha-trade/klines?symbol={s['symbol']}&interval={frame}&limit=1500&endTime={END}"
  b=get(url);rec['source']=BASE+url
  if b.get('code')!='000000' or not isinstance(b.get('data'),list):raise ValueError(str(b.get('message')))
  raw=b['data'];rec['rows']=[r for r in raw if START<=int(r[0]) and int(r[6])<END]
  rec['paginationComplete']=not raw or int(raw[0][0])<=START or len(raw)<1500
  rec['fetchedAtUTC']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
 except Exception as e:rec['error']=str(e)
 write(p,rec);return rec
def deepen(job):
 s,frame=job;p=ROOT/(s['symbol']+'-'+frame+'.json');rec=json.loads(p.read_text());ms=FRAMES[frame]
 if rec.get('paginationComplete') or not rec['rows']:return rec
 for _ in range(100):
  cursor=int(rec['rows'][0][0])-1
  if cursor<START:rec['paginationComplete']=True;break
  try:
   b=get(f"/bapi/defi/v1/public/alpha-trade/klines?symbol={s['symbol']}&interval={frame}&limit=1500&endTime={cursor}")
   if b.get('code')!='000000':raise ValueError(str(b.get('message')))
   raw=b['data'];add=[r for r in raw if START<=int(r[0])<=cursor]
   if not add:rec['paginationComplete']=True;break
   rec['rows']=add+rec['rows'];rec['pagesAdded']=rec.get('pagesAdded',0)+1
   if int(raw[0][0])<=START or len(raw)<1500:rec['paginationComplete']=True
   write(p,rec)
   if rec['paginationComplete']:break
  except Exception as e:rec['paginationError']=str(e);break
 write(p,rec);return rec
if __name__=='__main__':
 import sys
 if (ROOT/'window.json').exists():window=json.loads((ROOT/'window.json').read_text())
 else:
  end=int(time.time()*1000);window={'start':end-180*86400000,'end':end};write(ROOT/'window.json',window)
 START,END=window['start'],window['end']
 info=get('/bapi/defi/v1/public/alpha-trade/get-exchange-info');write(ROOT/'exchange-info.json',info)
 universe=[s for s in info['data']['symbols'] if s['quoteAsset']=='USDT'];write(ROOT/'universe.json',universe)
 try:write(ROOT/'tokens.json',get('/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list'))
 except Exception as e:write(ROOT/'tokens.json',{'data':[],'error':str(e)})
 jobs=[(s,f) for f in FRAMES for s in universe]
 if '--deepen' in sys.argv:
  frames=sys.argv[sys.argv.index('--deepen')+1:] or ['4h','1h'];jobs=[(s,f) for f in frames for s in universe];fn=deepen
 else:fn=collect
 with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
  for i,rec in enumerate(pool.map(fn,jobs)):
   if i%40==0:print(i,len(jobs),rec['symbol'],rec['frame'],len(rec['rows']),rec.get('error'),flush=True)
 print('COMPLETE',len(jobs),flush=True)
