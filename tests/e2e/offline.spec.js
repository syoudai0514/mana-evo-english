import { test, expect } from '@playwright/test'
import { initialState, STATE_KEY } from '../../src/lib/state.js'
test('production worker precaches lazy lessons and allows an unopened story offline', async ({
  page,
  context
}) => {
  await page.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(state))
    },
    {
      key: STATE_KEY,
      state: {
        ...initialState(),
        profile: {
          nickname: 'そら',
          partner: 'howamy',
          createdAt: '2026-10-22T12:00:00Z'
        }
      }
    }
  )
  await page.goto('/?mock=1')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller))
    )
    .toBe(true)
  const caches = await page.evaluate(async () => {
    const names = await window.caches.keys()
    return names.filter((n) => n.startsWith('mee-'))
  })
  expect(caches.length).toBeGreaterThan(0)
  await context.setOffline(true)
  await page.goto('/?mock=1#/kidLibrary')
  await page.getByRole('button', { name: '📖 おはなし', exact: true }).click()
  await page.getByRole('button', { name: /まいごの ほし/ }).click()
  await expect(page.locator('.story-en')).toContainText('little star')
  await expect(page.locator('.story-choices button')).toHaveCount(2)
})

test('fixed asset fetch prefers the active version over an older cache', async ({
  page
}) => {
  await page.goto('/?mock=1')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller))
    )
    .toBe(true)
  const bytes = await page.evaluate(async () => {
    const manifest = await fetch('/precache.json').then((r) => r.json()),
      name = `mee-${manifest.version}`
    const cache = await caches.open(name),
      saved = await Promise.all(
        (await cache.keys()).map(async (request) => [
          request,
          await cache.match(request)
        ])
      )
    const old = await caches.open('mee-older-test')
    await old.put('/monsters/m049.webp', new Response('stale-image'))
    await caches.delete(name)
    const current = await caches.open(name)
    for (const [request, response] of saved)
      await current.put(request, response)
    return (await fetch('/monsters/m049.webp').then((r) => r.arrayBuffer()))
      .byteLength
  })
  expect(bytes).toBeGreaterThan(1000)
})
