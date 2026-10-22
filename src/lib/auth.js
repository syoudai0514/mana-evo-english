// Password authentication with tab-serialized refresh and logout/refresh race protection.
import {SUPABASE_ANON_KEY,SUPABASE_URL} from './config.js'
export const SESSION_KEY='mee-auth-v1'
export function createAuthClient({storage=globalThis.localStorage,fetcher=globalThis.fetch,locks=globalThis.navigator?.locks,onChange=()=>{}}={}){
 let generation=0,refreshing=null
 const read=()=>{try{return JSON.parse(storage?.getItem(SESSION_KEY)||'null')}catch{return null}}
 const write=session=>{try{if(!storage)throw new Error('storage');if(session)storage.setItem(SESSION_KEY,JSON.stringify(session));else storage.removeItem(SESSION_KEY);onChange(session);return true}catch{if(session)throw new Error('ログイン情報を保存できません。ブラウザーの保存設定を確認してください');return false}}
 const request=async(path,body,token)=>{const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),12000);try{const response=await fetcher(`${SUPABASE_URL}/auth/v1${path}`,{method:body===undefined?'GET':'POST',headers:{apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:abort.signal});const data=await response.json().catch(()=>null);if(!response.ok)throw Object.assign(new Error(data?.error_description||data?.msg||data?.message||'認証を確認できませんでした'),{status:response.status});return data}catch(error){if(error.status)throw error;throw new Error('通信できませんでした。接続を確認してください')}finally{clearTimeout(timer)}}
 const make=data=>({access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Math.floor(Date.now()/1000)+(Number(data.expires_in)||3600),email:data.user?.email||'',userId:data.user?.id||null})
 const client={
  session:read,
  async signIn(email,password){const version=++generation;const data=await request('/token?grant_type=password',{email,password});if(version!==generation)throw new Error('ログイン操作が変更されました。もう一度お試しください');const session=make(data);write(session);return session},
  signOut(){const old=read();generation++;write(null);if(old?.access_token)void request('/logout?scope=local',{},old.access_token).catch(()=>{});return true},
  async getAccessToken({force=false}={}){const current=read();if(!current?.refresh_token)return null;if(!force&&current.expires_at-60>Date.now()/1000)return current.access_token;if(refreshing)return refreshing
   const refresh=async()=>{const session=read();if(!session?.refresh_token)return null;if(session.refresh_token!==current.refresh_token&&session.expires_at-30>Date.now()/1000)return session.access_token;const version=generation;try{const data=await request('/token?grant_type=refresh_token',{refresh_token:session.refresh_token});const latest=read();if(version!==generation||!latest)return null;if(latest.refresh_token!==session.refresh_token)return latest.access_token;const next=make({...data,user:data.user||{id:session.userId,email:session.email}});write(next);return next.access_token}catch(error){const latest=read();if(version!==generation||!latest)return null;if(latest.refresh_token!==session.refresh_token)return latest.access_token;if(error.status===400||error.status===401){generation++;write(null)}throw error}}
   const promise=locks?.request?locks.request('mee-auth-refresh',refresh):refresh();refreshing=Promise.resolve(promise).finally(()=>{refreshing=null});return refreshing
  },
  async getUser(){const token=await client.getAccessToken();if(!token)return null;const version=generation;const user=await request('/user',undefined,token);const session=read();if(version!==generation||!session||session.access_token!==token)return null;if(user?.id&&!session.userId)write({...session,userId:user.id});return {id:user.id,email:user.email||''}},
  invalidate(){generation++;onChange(read())}
 };return client
}
const listeners=new Set()
const emit=()=>{for(const fn of listeners)fn()}
let storage;try{storage=globalThis.localStorage}catch{storage=undefined}
const auth=createAuthClient({storage,onChange:emit})
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===SESSION_KEY)auth.invalidate()})
export const signIn=(...args)=>auth.signIn(...args)
export const signOut=()=>auth.signOut()
export const currentEmail=()=>auth.session()?.email||''
export const isSignedIn=()=>Boolean(auth.session()?.refresh_token)
export const getAccessToken=(...args)=>auth.getAccessToken(...args)
export const getCurrentUser=()=>auth.getUser()
export function subscribeAuth(fn){listeners.add(fn);return()=>listeners.delete(fn)}
