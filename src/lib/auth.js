// mana-evo と同じ Supabase アカウント（メールとパスワード）でログインする。
// セッションは端末内に保存し、期限が近ければ refresh token で更新する。
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js'

const SESSION_KEY = 'mee-auth-v1'

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}

function writeSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {}
}

function toSession(data) {
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    email: data.user?.email || ''
  }
}

async function authRequest(path, body) {
  let response
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  } catch {
    throw new Error('つうしんできませんでした。電波を確認してください')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(data?.msg || data?.error_description || data?.message || 'ログインできませんでした')
    error.status = response.status
    throw error
  }
  return data
}

export async function signIn(email, password) {
  const data = await authRequest('/token?grant_type=password', { email, password })
  const session = toSession(data)
  writeSession(session)
  return session
}

export function signOut() {
  writeSession(null)
}

export function currentEmail() {
  return readSession()?.email || ''
}

export function isSignedIn() {
  return Boolean(readSession()?.refresh_token)
}

let refreshing = null

export async function getAccessToken({ force = false } = {}) {
  const session = readSession()
  if (!session?.refresh_token) return null
  const fresh = session.expires_at - 60 > Date.now() / 1000
  if (fresh && !force) return session.access_token
  if (!refreshing) {
    refreshing = authRequest('/token?grant_type=refresh_token', { refresh_token: session.refresh_token })
      .then((data) => { const next = toSession({ ...data, user: data.user || { email: session.email } }); writeSession(next); return next.access_token })
      .catch((error) => { if (error.status === 400 || error.status === 401) writeSession(null); throw error })
      .finally(() => { refreshing = null })
  }
  return refreshing
}
