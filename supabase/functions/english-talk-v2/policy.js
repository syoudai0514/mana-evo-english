export const MAX_BODY_BYTES=4096
export function validateLiveBody(body){
 if(!body||typeof body!=='object'||Array.isArray(body))return false
 if(!['live-token','live-log','live-release'].includes(body.action))return false
 if(body.action==='live-token'&&((body.purpose&&!['voice','text','asr'].includes(body.purpose))||(body.liveModel&&!['auto','3-flash','3.8','2.5-audio','3.5-transcribe'].includes(body.liveModel))))return false
 if(body.action==='live-release'&&!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(body.leaseId||''))return false
 return true
}
export function safeDiagnostic(info){return {step:String(info?.step||'unknown').replace(/[^a-z0-9_-]/gi,'').slice(0,40),code:typeof info?.code==='number'?info.code:0,platform:/iphone|ipad/i.test(String(info?.ua||''))?'ios':'other'}}
export function ephemeralRequest(model,now=Date.now()){return {uses:1,expireTime:new Date(now+10*60_000).toISOString(),newSessionExpireTime:new Date(now+2*60_000).toISOString(),bidiGenerateContentSetup:{model:`models/${model}`},fieldMask:'model'}}
