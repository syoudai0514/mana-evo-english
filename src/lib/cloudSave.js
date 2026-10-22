import MANA_SPECIES_NAMES from '../data/mana-species-names.json' with { type: 'json' }
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'
import { getAccessToken, getCurrentUser } from './auth.js'
import { loadState, STATE_KEY } from './state.js'
import { loadAdultStore, ADULT_KEY } from './adult.js'
import { loadLearning, LEARNING_KEY } from './learning.js'
export const ENGLISH_APP_ID = 'mana-evo-english',
  SCHEMA_VERSION = 1
const record = (v) => v && typeof v === 'object' && !Array.isArray(v)
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical)
  if (record(v))
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, canonical(v[k])])
    )
  return v
}
export async function payloadHash(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(payload)))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
}
export function exportLearningPayload({ state, adultStore, learning }) {
  return {
    appId: ENGLISH_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    state,
    adultStore,
    learning
  }
}
export function validateLearningPayload(payload) {
  if (
    !record(payload) ||
    payload.appId !== ENGLISH_APP_ID ||
    payload.schemaVersion !== 1 ||
    !record(payload.state) ||
    !record(payload.adultStore) ||
    !record(payload.learning)
  )
    throw new Error('対応していない保存データです')
  const s = payload.state,
    a = payload.adultStore,
    l = payload.learning
  if (
    s.version !== 1 ||
    !Array.isArray(s.sessions) ||
    !Array.isArray(s.stickers) ||
    !record(s.friendship) ||
    !Array.isArray(a.order) ||
    !record(a.adults) ||
    a.version !== 1 ||
    l.version !== 1 ||
    !record(l.learners)
  )
    throw new Error('保存データの形式を確認できませんでした')
  if (
    s.profile &&
    (!record(s.profile) ||
      typeof s.profile.nickname !== 'string' ||
      typeof s.profile.partner !== 'string')
  )
    throw new Error('子供プロフィールが不正です')
  if (
    s.sessions.length > 1000 ||
    a.order.length > 100 ||
    Object.keys(l.learners).length > 200 ||
    JSON.stringify(payload).length > 5_000_000
  )
    throw new Error('保存データが大きすぎます')
  for (const id of a.order)
    if (
      !record(a.adults[id]) ||
      a.adults[id].id !== id ||
      !Array.isArray(a.adults[id].cards) ||
      !Array.isArray(a.adults[id].answers) ||
      !Array.isArray(a.adults[id].sessions)
    )
      throw new Error('大人プロフィールが不正です')
  for (const [key, p] of Object.entries(l.learners)) {
    if (
      !/^(adult|kid):.{1,160}$/.test(key) ||
      !record(p) ||
      (p.completed !== undefined && !record(p.completed)) ||
      (p.drafts !== undefined && !record(p.drafts)) ||
      (p.reports !== undefined && !Array.isArray(p.reports)) ||
      (p.toeicSessions !== undefined && !record(p.toeicSessions))
    )
      throw new Error('教材の記録が不正です')
    for (const draft of Object.values(p.drafts || {}))
      if (
        !record(draft) ||
        !Number.isInteger(draft.index) ||
        draft.index < 0 ||
        !record(draft.answers) ||
        !record(draft.notes) ||
        !Array.isArray(draft.path)
      )
        throw new Error('途中保存の形式が不正です')
  }
  return payload
}
export function parseLearningFile(text) {
  if (text.length > 5_000_000) throw new Error('ファイルが大きすぎます')
  return validateLearningPayload(JSON.parse(text))
}
export function emptyLearningPayload(payload) {
  return (
    !payload.state.profile &&
    !payload.adultStore.order.length &&
    !Object.keys(payload.learning.learners).length
  )
}
export function decideCloudSync({
  localHash,
  remoteHash,
  revision,
  meta,
  empty = false
}) {
  if (!revision) return 'upload'
  if (localHash === remoteHash) return 'same'
  if (empty) return 'download'
  if (meta?.hash === localHash && revision >= meta.revision) return 'download'
  if (meta?.hash === remoteHash && revision === meta.revision) return 'upload'
  return 'conflict'
}
export function hydrateLearningPayload(payload) {
  validateLearningPayload(payload)
  const virtual = {
    getItem: (key) =>
      JSON.stringify(
        key === STATE_KEY
          ? payload.state
          : key === ADULT_KEY
            ? payload.adultStore
            : payload.learning
      )
  }
  return {
    state: loadState(virtual),
    adultStore: loadAdultStore(virtual),
    learning: loadLearning(virtual)
  }
}
export function keepRecovery(payload, storage = localStorage) {
  validateLearningPayload(payload)
  const key = 'mee-recovery-v1'
  const previous = JSON.parse(storage.getItem(key) || '[]')
  if (!Array.isArray(previous))
    throw new Error('復元用バックアップを確認できませんでした')
  storage.setItem(
    key,
    JSON.stringify(
      [{ capturedAt: new Date().toISOString(), payload }, ...previous].slice(
        0,
        3
      )
    )
  )
  return true
}
const eq = (value) => `eq.${encodeURIComponent(value)}`
export function createSaveClient({
  fetcher = globalThis.fetch,
  getUser = getCurrentUser,
  getToken = getAccessToken,
  storage = globalThis.localStorage
} = {}) {
  async function auth() {
    const user = await getUser(),
      token = await getToken()
    if (!user?.id || !token)
      throw Object.assign(new Error('設定でログインしてください'), {
        code: 'auth'
      })
    return { user, token }
  }
  async function request(path, { method = 'GET', body, user, token } = {}) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetcher(`${SUPABASE_URL}/rest/v1/${path}`, {
        method,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal
      })
      const data = await response.json().catch(() => null)
      if (!response.ok)
        throw Object.assign(
          new Error(
            response.status === 401
              ? 'ログインを確認してください'
              : 'クラウドの記録を確認できませんでした'
          ),
          {
            code: response.status === 409 ? 'conflict' : 'network',
            status: response.status
          }
        )
      return data
    } catch (error) {
      if (error.code) throw error
      throw new Error('通信が完了しませんでした。端末の記録はそのままです')
    } finally {
      clearTimeout(timer)
    }
  }
  const metaKey = (id) => `mee-cloud-meta-v1:${id}`
  function meta(id) {
    try {
      return JSON.parse(storage.getItem(metaKey(id)) || 'null')
    } catch {
      return null
    }
  }
  function remember(id, revision, hash) {
    storage.setItem(metaKey(id), JSON.stringify({ revision, hash }))
  }
  async function getRow(credentials) {
    const { user } = credentials
    const rows = await request(
      `app_saves?select=revision,schema_version,payload,updated_at&user_id=${eq(user.id)}&app_id=${eq(ENGLISH_APP_ID)}&slot_id=eq.main&limit=1`,
      credentials
    )
    const row = rows?.[0] || null
    if (row) {
      if (
        row.schema_version !== 1 ||
        !Number.isSafeInteger(Number(row.revision))
      )
        throw new Error('新しい形式のクラウド記録があります。上書きしません')
      validateLearningPayload(row.payload)
    }
    return row
  }
  async function inspect(payload) {
    validateLearningPayload(payload)
    const credentials = await auth(),
      row = await getRow(credentials),
      localHash = await payloadHash(payload),
      remoteHash = row ? await payloadHash(row.payload) : null
    const action = decideCloudSync({
      localHash,
      remoteHash,
      revision: row?.revision,
      meta: meta(credentials.user.id),
      empty: emptyLearningPayload(payload)
    })
    if (action === 'same')
      remember(credentials.user.id, row.revision, localHash)
    return { action, row, localHash, remoteHash, userId: credentials.user.id }
  }
  async function preserve(credentials, local, row, reason) {
    return request('app_save_recovery_candidates', {
      ...credentials,
      method: 'POST',
      body: {
        user_id: credentials.user.id,
        app_id: ENGLISH_APP_ID,
        slot_id: 'main',
        schema_version: 1,
        reason,
        base_revision: meta(credentials.user.id)?.revision ?? null,
        base_hash: meta(credentials.user.id)?.hash ?? null,
        cloud_revision: row.revision,
        cloud_hash: await payloadHash(row.payload),
        local_hash: await payloadHash(local),
        local_payload: local,
        cloud_payload: row.payload,
        status: 'unresolved'
      }
    })
  }
  return {
    inspect,
    async upload(payload, expected) {
      validateLearningPayload(payload)
      const credentials = await auth()
      if (expected.userId !== credentials.user.id)
        throw new Error(
          'アカウントが切り替わりました。もう一度確認してください'
        )
      const row = await getRow(credentials)
      if (
        (row?.revision || 0) !== (expected.row?.revision || 0) ||
        (row && (await payloadHash(row.payload)) !== expected.remoteHash)
      )
        throw Object.assign(
          new Error(
            '別の端末で更新されました。もう一度同期状況を確認してください'
          ),
          { code: 'conflict' }
        )
      if (row) {
        await preserve(
          credentials,
          payload,
          row,
          'english-before-manual-upload'
        )
        await request('app_save_backups', {
          ...credentials,
          method: 'POST',
          body: {
            user_id: credentials.user.id,
            app_id: ENGLISH_APP_ID,
            slot_id: 'main',
            schema_version: 1,
            revision: row.revision,
            reason: 'english-before-upload',
            payload: row.payload
          }
        })
      }
      const result = await request(
        row
          ? `app_saves?user_id=${eq(credentials.user.id)}&app_id=${eq(ENGLISH_APP_ID)}&slot_id=eq.main&revision=${eq(row.revision)}`
          : 'app_saves',
        {
          ...credentials,
          method: row ? 'PATCH' : 'POST',
          body: {
            user_id: credentials.user.id,
            app_id: ENGLISH_APP_ID,
            slot_id: 'main',
            revision: (Number(row?.revision) || 0) + 1,
            schema_version: 1,
            payload,
            updated_at: new Date().toISOString()
          }
        }
      )
      if (!result?.length)
        throw Object.assign(
          new Error('競合しました。端末の記録は保持されています'),
          { code: 'conflict' }
        )
      remember(
        credentials.user.id,
        result[0].revision,
        await payloadHash(payload)
      )
      return result[0]
    },
    async download(local, expected) {
      const credentials = await auth()
      if (expected.userId !== credentials.user.id)
        throw new Error('アカウントが切り替わりました')
      const row = await getRow(credentials)
      if (
        !row ||
        row.revision !== expected.row?.revision ||
        (await payloadHash(row.payload)) !== expected.remoteHash
      )
        throw new Error('クラウドが更新されました。もう一度確認してください')
      await preserve(credentials, local, row, 'english-before-manual-restore')
      keepRecovery(local, storage)
      remember(
        credentials.user.id,
        row.revision,
        await payloadHash(row.payload)
      )
      return hydrateLearningPayload(row.payload)
    },
    async readManaEvo() {
      const credentials = await auth()
      return request(
        `app_saves?select=slot_id,schema_version,payload&user_id=${eq(credentials.user.id)}&app_id=eq.mana-evo&order=slot_id.asc`,
        credentials
      )
    }
  }
}
export function rosterFromManaEvo(rows) {
  const found = new Map()
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!record(row)) continue
    const payload = row.payload
    if (
      row.schema_version !== 1 ||
      payload?.appId !== 'mana-evo' ||
      payload.saveSchemaVersion !== 1
    )
      continue
    const games = payload.gameEnvelope?.gameByProfile
    if (!record(games)) continue
    for (const [profileId, game] of Object.entries(games)) {
      if (!record(game?.box)) continue
      for (const monster of Object.values(game.box)) {
        const speciesId = String(monster.speciesId || monster.species || '')
        if (
          !/^m\d{3,4}$/.test(speciesId) ||
          !Number.isFinite(monster.caughtAt) ||
          monster.caughtAt <= 0
        )
          continue
        const id = `mana:${speciesId}`
        if (!found.has(id))
          found.set(id, {
            id,
            speciesId,
            sourceProfile: profileId,
            name: String(
              monster.nickname ||
                monster.name ||
                MANA_SPECIES_NAMES[speciesId] ||
                speciesId
            ).slice(0, 24),
            level: Math.max(1, Math.min(999, Number(monster.level) || 1))
          })
      }
    }
  }
  return [...found.values()].slice(0, 300)
}
// Keep all three local stores consistent when a restore cannot be committed.
export function persistLearningPayload(
  payload,
  storage = globalThis.localStorage
) {
  validateLearningPayload(payload)
  const entries = [
    [STATE_KEY, payload.state],
    [ADULT_KEY, payload.adultStore],
    [LEARNING_KEY, payload.learning]
  ]
  const old = entries.map(([key]) => [key, storage.getItem(key)])
  try {
    for (const [key, value] of entries)
      storage.setItem(key, JSON.stringify(value))
  } catch (error) {
    for (const [key, value] of old) {
      try {
        if (value === null || value === undefined) storage.removeItem(key)
        else storage.setItem(key, value)
      } catch {}
    }
    throw new Error(
      '復元を保存できませんでした。変更前の記録は復元用バックアップから確認できます'
    )
  }
  return hydrateLearningPayload(payload)
}
