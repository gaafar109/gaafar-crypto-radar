"""Research-only one-shot Binance Alpha aggressor-flow collector.
No credentials, trading, Telegram or production deployment.
Usage: python research/alpha-liquidity-radar/collect_trades.py
Writes per-symbol evidence and coverage status under data/alpha-flow/.
"""
import concurrent.futures, datetime, json, pathlib, time, urllib.error, urllib.parse, urllib.request
BASE='https://www.binance.com'
OUT=pathlib.Path('data/alpha-flow')
OUT.mkdir(parents=True,exist_ok=True)
HALT=False
def fetch(path,params=None):
    global HALT
    if HALT: raise RuntimeError('halted on access/rate-limit response')
    url=BASE+path+('?' + urllib.parse.urlencode(params) if params else '')
    req=urllib.request.Request(url,headers={'Accept':'application/json','User-Agent':'GAAFARYPTO-research/2'})
    try:
        with urllib.request.urlopen(req,timeout=15) as r: return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code in (403,418,429,451): HALT=True
        raise
def unwrap(body):
    if not isinstance(body,dict) or str(body.get('code'))!='000000':raise ValueError('unexpected API response')
    return body.get('data')
def measure(data):
    if not isinstance(data,list):raise ValueError('trade data not a list')
    buy=sell=0.; last=-1; first=None
    for t in data:
        if not isinstance(t,dict) or type(t.get('m')) is not bool:raise ValueError('missing verified buyer-maker flag')
        stamp=int(t['T']);price=float(t['p']);qty=float(t['q'])
        if stamp<last or price<=0 or qty<=0:raise ValueError('invalid or unordered trade')
        last=stamp;first=stamp if first is None else first
        if t['m']:sell+=price*qty
        else:buy+=price*qty
    total=buy+sell
    return {'trades':len(data),'firstTradeMs':first,'lastTradeMs':last,'buyQuote':buy,
            'sellQuote':sell,'netAggressiveQuote':buy-sell,
            'imbalance':(buy-sell)/total if total else None,
            'coverage':'LAST_PAGE_ONLY; NOT FULL WINDOW',
            'directionValidation':'REQUIRES_VERIFICATION_AGAINST_ALPHA_OFFICIAL_SCHEMA'}
def one(symbol):
    now=int(time.time()*1000)
    record={'symbol':symbol,'fetchedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'status':'UNVERIFIED','flow':None}
    try:
        data=unwrap(fetch('/bapi/defi/v1/public/alpha-trade/agg-trades',{'symbol':symbol,'limit':1000}))
        record['flow']=measure(data)
        record['status']='PARTIAL_SAMPLE_ONLY'
    except Exception as e:record['error']=str(e)
    path=OUT/(symbol+'.json')
    tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(record,indent=2));tmp.replace(path)
    return record
def main():
    try:
        universe=unwrap(fetch('/bapi/defi/v1/public/alpha-trade/get-exchange-info'))
        symbols=[s['symbol'] for s in universe['symbols'] if s.get('status')=='TRADING' and s.get('quoteAsset')=='USDT']
    except Exception as e:
        print('UNIVERSE_FETCH_FAILED',str(e));return 2
    results=[]
    # Sequential, conservative request pacing; stop after access/rate limit.
    for i,symbol in enumerate(symbols):
        if HALT:break
        results.append(one(symbol))
        if (i+1)%25==0:print('checked',i+1,'of',len(symbols),flush=True)
        time.sleep(.35)
    summary={'discoveredActive':len(symbols),'attempted':len(results),
             'partialSamples':sum(r['status']=='PARTIAL_SAMPLE_ONLY' for r in results),
             'halted':HALT,'notAFullMarketCVD':True,'notTradingSignals':True}
    (OUT/'summary.json').write_text(json.dumps(summary,indent=2))
    print(json.dumps(summary));return 0 if len(results)==len(symbols) else 3
if __name__=='__main__':
    raise SystemExit(main())
