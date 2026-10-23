import { MAX_BODY_BYTES,validateLiveBody,safeDiagnostic,ephemeralRequest } from './policy.js'
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')??''
const SUPABASE_ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')??''
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??''
const GEMINI_API_KEY=Deno.env.get('GEMINI_API_KEY')??''
// 許可するモデル（接続先で利用できる許可モデル）
const LIVE_ALLOWED: Record<string, RegExp> = {
  '3-flash': /^gemini-3(\.1)?-flash-live(-preview)?$/,
  '3.8': /^gemini-3\.8-live$/,
  '2.5-audio': /^gemini-2\.5-flash-native-audio/,
  '3.5-transcribe': /^gemini-3\.5-transcribe-live/
}
// おまかせの順番。会話（声）は速さ優先、読みづくり（文字）は賢さ優先
const AUTO_ORDER: Record<string, string[]> = {
  voice: ['3-flash', '3.8', '2.5-audio'],
  text: ['3.8', '3-flash'],
  asr: ['3.5-transcribe'] // 子どもの声の文字起こし専用
}
let liveModelsCache: { names: string[]; at: number } | null = null

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

// ログインしている人の id（していなければ null）
async function verifyUser(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: SUPABASE_ANON_KEY }
  })
  if (!response.ok) return null
  const user = await response.json().catch(() => null)
  return user?.id ? String(user.id) : null
}

// このキーで使える Live モデルのうち、許可した2つだけを返す
async function listAllowedLiveModels(): Promise<string[]> {
  if (liveModelsCache && Date.now() - liveModelsCache.at < 6 * 3600_000) return liveModelsCache.names
  const names: string[] = []
  let pageToken = ''
  for (let page = 0; page < 5; page += 1) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`
    const response = await fetch(url, { headers: { 'x-goog-api-key': GEMINI_API_KEY } })
    if (!response.ok) break
    const data = await response.json()
    for (const model of data.models ?? []) {
      const name = String(model.name).replace(/^models\//, '')
      const live = (model.supportedGenerationMethods ?? []).includes('bidiGenerateContent')
      if (live && Object.values(LIVE_ALLOWED).some((pattern) => pattern.test(name))) names.push(name)
    }
    pageToken = data.nextPageToken ?? ''
    if (!pageToken) break
  }
  if (names.length) liveModelsCache = { names, at: Date.now() }
  return names
}

async function pickLiveModel(choice?: string, purpose = 'voice'): Promise<string | null> {
  const names = await listAllowedLiveModels()
  const auto = AUTO_ORDER[purpose] ?? AUTO_ORDER.voice
  // 決めた名前だけを受けつける（"constructor" などの名前で落ちないように）
  const order = choice && Object.hasOwn(LIVE_ALLOWED, choice) ? [choice, ...auto.filter((id) => id !== choice)] : auto
  for (const id of order) {
    // 2.5 は名前ちがいがいくつかあるので latest を優先
    const hits = names.filter((name) => LIVE_ALLOWED[id].test(name)).sort((a, b) => Number(b.endsWith('latest')) - Number(a.endsWith('latest')))
    if (hits.length) return hits[0]
  }
  return null
}


async function guard(userId:string,action:string,leaseId:string|null=null){
 const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/mee_live_guard`,{method:'POST',headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({p_user_id:userId,p_action:action,p_lease_id:leaseId})})
 if(!r.ok)throw new Error('guard unavailable')
 return r.json()
}
async function createLiveToken(model:string){
 const response=await fetch('https://generativelanguage.googleapis.com/v1alpha/auth_tokens',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':GEMINI_API_KEY},body:JSON.stringify(ephemeralRequest(model))})
 const data=await response.json().catch(()=>null)
 if(!response.ok||!data?.name){console.error('live token failed',response.status);return null}
 return data.name as string
}
async function boundedBody(req:Request){
 if(Number(req.headers.get('Content-Length')||0)>MAX_BODY_BYTES)throw new Error('body too large')
 const reader=req.body?.getReader();if(!reader)return null
 let size=0;const chunks:Uint8Array[]=[]
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY_BYTES){await reader.cancel();throw new Error('body too large')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 return JSON.parse(new TextDecoder().decode(bytes))
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:CORS})
 if(req.method!=='POST')return json({code:'bad_request'},405)
 try{
  const userId=await verifyUser(req);if(!userId)return json({code:'auth',message:'ログインが必要です'},401)
  let body;try{body=await boundedBody(req)}catch{return json({code:'bad_request',message:'リクエストを確認してください'},400)}
  if(!validateLiveBody(body))return json({code:'bad_request'},400)
  if(!SERVICE_KEY)return json({code:'config',message:'接続の設定を確認してください'},503)
  if(body.action==='live-release'){await guard(userId,'live-release',body.leaseId);return json({ok:true})}
  if(body.action==='live-token'&&!GEMINI_API_KEY)return json({code:'config',message:'接続の設定を確認してください'},503)
  const access=await guard(userId,body.action)
  if(!access.ok)return json({code:access.code,message:'接続が多くなっています。少し待ってもう一度お試しください'},429)
  if(body.action==='live-log'){console.warn('live diagnostic',JSON.stringify(safeDiagnostic(body.info)));return json({ok:true})}
  const leaseId=access.leaseId
  try{
   const model=await pickLiveModel(body.liveModel,body.purpose||'voice')
   if(!model){await guard(userId,'live-release',leaseId);return json({code:'no_live_model'},503)}
   const token=await createLiveToken(model)
   if(!token){await guard(userId,'live-release',leaseId);return json({code:'live_token'},502)}
   return json({token,model,leaseId})
  }catch{await guard(userId,'live-release',leaseId).catch(()=>{});return json({code:'network',message:'接続できませんでした'},502)}
 }catch{console.error('english-talk-v2 request failed');return json({code:'server',message:'接続の確認に失敗しました'},503)}
})
