export const AI_CONSENT_KEY='mee-ai-consent-v1'
export function aiConsent(storage=globalThis.localStorage){try{return JSON.parse(storage?.getItem(AI_CONSENT_KEY)||'null')?.policyVersion===1}catch{return false}}
export function setAiConsent(enabled,storage=globalThis.localStorage){if(enabled)storage.setItem(AI_CONSENT_KEY,JSON.stringify({policyVersion:1,acceptedAt:new Date().toISOString()}));else storage.removeItem(AI_CONSENT_KEY)}
export function downloadJson(name,payload){const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
