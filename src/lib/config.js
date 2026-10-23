// 共有 Supabase（app-save-hub）。anon key はブラウザに置いてよい公開キーで、
// テーブルは RLS、english-talk はログイン中のユーザーだけが使える。
export const SUPABASE_URL = 'https://wdwbmvpipbdpomqulsrj.supabase.co'
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indkd2JtdnBpcGJkcG9tcXVsc3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4ODA3MjYsImV4cCI6MjEwMzQ1NjcyNn0.Z4Jd15Vyl22qYXod35xk3vdzCBb3cvZcxIXIq85mqEU'
export const TALK_ENDPOINT = `${SUPABASE_URL}/functions/v1/english-talk-v2`
export const APP_ID = 'mana-evo-english'

// ?mock=1 で、AIを呼ばずに端末内のダミー相手と会話する（画面確認用）
export function isMockMode() {
  try {
    const params = new URLSearchParams(location.search)
    if (params.has('mock')) localStorage.setItem('mee-mock', params.get('mock') === '0' ? '0' : '1')
    return localStorage.getItem('mee-mock') === '1'
  } catch {
    return false
  }
}
