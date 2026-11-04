/**
 * GAAFARYPTO research-only Google Apps Script relay extension.
 * Deploy as a SEPARATE test web app. Do not overwrite the existing production relay.
 * Script Properties: RESEARCH_RELAY_KEY (create a new random key; never commit it).
 * POST JSON: {key, endpoint:'aggTrades'|'depth', symbol, limit}
 * WARNING: The Alpha response schema and buyer-maker semantics remain UNVERIFIED.
 * No signal, trade, webhook or Cloudflare production integration.
 */
const RESEARCH_ALPHA_BASE='https://www.binance.com/bapi/defi/v1/public/alpha-trade';
const RESEARCH_ENDPOINTS=Object.freeze({
  aggTrades:'/agg-trades',
  depth:'/fullDepth'
});
function researchReply(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  try {
    const request=JSON.parse(e && e.postData && e.postData.contents || '{}');
    const expected=PropertiesService.getScriptProperties().getProperty('RESEARCH_RELAY_KEY');
    if(!expected || typeof request.key!=='string' || request.key!==expected)
      return researchReply({ok:false,error:'unauthorized'});
    const endpoint=RESEARCH_ENDPOINTS[request.endpoint];
    if(!endpoint)return researchReply({ok:false,error:'unsupported endpoint'});
    const symbol=String(request.symbol||'');
    if(!/^ALPHA_[0-9]+USDT$/.test(symbol))
      return researchReply({ok:false,error:'invalid symbol'});
    const limit=Number(request.limit===undefined?100:request.limit);
    if(!Number.isInteger(limit)||limit<1||limit>1000)
      return researchReply({ok:false,error:'invalid limit'});
    const url=RESEARCH_ALPHA_BASE+endpoint+'?symbol='+encodeURIComponent(symbol)+'&limit='+limit;
    const response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:false});
    const code=response.getResponseCode();
    if(code!==200)return researchReply({ok:false,error:'upstream_http_'+code});
    const body=response.getContentText();
    if(body.length>900000)return researchReply({ok:false,error:'response_too_large'});
    let parsed;
    try{parsed=JSON.parse(body)}catch(_){return researchReply({ok:false,error:'upstream_not_json'})}
    if(!parsed || typeof parsed!=='object' || String(parsed.code)!=='000000' || parsed.data===undefined || parsed.data===null)
      return researchReply({ok:false,error:'upstream_application_error'});
    return researchReply({ok:true,endpoint:request.endpoint,symbol,
      fetchedAt:new Date().toISOString(),source:'binance-alpha-research-relay',
      validation:'RAW_UNVERIFIED',body:parsed});
  }catch(err){
    return researchReply({ok:false,error:'request_failed'});
  }
}
