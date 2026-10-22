import test from 'node:test'
import assert from 'node:assert/strict'
import { createAuthClient, SESSION_KEY } from '../src/lib/auth.js'
function fixture() {
  const map = new Map([
    [
      SESSION_KEY,
      JSON.stringify({
        access_token: 'old',
        refresh_token: 'refresh-old',
        expires_at: 1,
        email: 'test@example.invalid'
      })
    ]
  ])
  return {
    getItem: (k) => map.get(k),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k)
  }
}
const reply = (data) => ({ ok: true, json: async () => data })
test('logout while refresh is pending never resurrects the session', async () => {
  const storage = fixture()
  let resolve
  const client = createAuthClient({
    storage,
    fetcher: (url) =>
      url.includes('/logout')
        ? Promise.resolve(reply({}))
        : new Promise((r) => (resolve = r))
  })
  const pending = client.getAccessToken()
  client.signOut()
  resolve(
    reply({
      access_token: 'new',
      refresh_token: 'new-refresh',
      expires_in: 3600,
      user: { id: 'user' }
    })
  )
  assert.equal(await pending, null)
  assert.equal(storage.getItem(SESSION_KEY), undefined)
})
test('concurrent refresh requests share a single request', async () => {
  const storage = fixture()
  let calls = 0
  const client = createAuthClient({
    storage,
    fetcher: async () => {
      calls++
      return reply({
        access_token: 'new',
        refresh_token: 'new-refresh',
        expires_in: 3600
      })
    }
  })
  assert.deepEqual(
    await Promise.all([client.getAccessToken(), client.getAccessToken()]),
    ['new', 'new']
  )
  assert.equal(calls, 1)
})
test('another tab refreshing first wins over an old token response', async () => {
  const storage = fixture()
  let resolve
  const client = createAuthClient({
    storage,
    fetcher: () => new Promise((r) => (resolve = r))
  })
  const pending = client.getAccessToken()
  storage.setItem(
    SESSION_KEY,
    JSON.stringify({
      access_token: 'other-tab',
      refresh_token: 'other-refresh',
      expires_at: 9999999999
    })
  )
  resolve(
    reply({
      access_token: 'stale',
      refresh_token: 'stale-refresh',
      expires_in: 3600
    })
  )
  assert.equal(await pending, 'other-tab')
  assert.equal(client.session().access_token, 'other-tab')
})
test('network failures retain refresh credentials and invalid refresh removes them', async () => {
  const storage = fixture()
  const client = createAuthClient({
    storage,
    fetcher: async () => {
      throw new TypeError('offline')
    }
  })
  await assert.rejects(client.getAccessToken())
  assert.ok(storage.getItem(SESSION_KEY))
  const bad = createAuthClient({
    storage,
    fetcher: async () => ({
      ok: false,
      status: 400,
      json: async () => ({ msg: 'invalid refresh' })
    })
  })
  await assert.rejects(bad.getAccessToken())
  assert.equal(storage.getItem(SESSION_KEY), undefined)
})
