"""Single current depth snapshot for all active USDT pairs, not historical depth."""
from collect import *
universe=json.loads((ROOT/'universe.json').read_text())
def snapshot(s):
 p=ROOT/(s['symbol']+'-depth.json')
 if p.exists():return
 try:
  body=get('/bapi/defi/v1/public/alpha-trade/fullDepth?symbol='+s['symbol']+'&limit=100')
  write(p,{'symbol':s['symbol'],'fetchedAt':int(time.time()*1000),'body':body})
 except Exception as e:write(p,{'symbol':s['symbol'],'error':str(e)})
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for i,r in enumerate(pool.map(snapshot,[s for s in universe if s['status']=='TRADING'])):
  if i%40==0:print(i,flush=True)
print('COMPLETE',flush=True)
