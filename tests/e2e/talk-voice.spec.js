import { test, expect } from '@playwright/test'
import { initialState, STATE_KEY, PIN_KEY } from '../../src/lib/state.js'
async function parentTalk(page, { fail = false, parent = true } = {}) {
  await page.addInitScript(
    ({ state, key, pin, fail }) => {
      localStorage.setItem(key, JSON.stringify(state))
      localStorage.setItem(pin, '1234')
      localStorage.setItem('mee-keys', '1')
      window.spoken = []
      Object.defineProperty(window, 'speechSynthesis', {
        value: {
          getVoices: () => [],
          cancel: () => {},
          speak: (utterance) => {
            if (utterance.text.trim())
              window.spoken.push({ text: utterance.text, lang: utterance.lang })
            queueMicrotask(() =>
              fail ? utterance.onerror?.() : utterance.onend?.()
            )
          }
        }
      })
    },
    {
      state: {
        ...initialState(),
        profile: {
          nickname: 'そら',
          partner: 'howamy',
          createdAt: 'voice-test'
        }
      },
      key: STATE_KEY,
      pin: PIN_KEY,
      fail
    }
  )
  await page.goto('/?mock=1')
  if (!parent) {
    await page
      .getByRole('button', { name: 'おはなし する！', exact: true })
      .click()
    return
  }
  await page
    .getByRole('navigation', { name: 'こどものメニュー' })
    .getByRole('button', { name: /おうちのひと/ })
    .click()
  for (const digit of ['1', '2', '3', '4'])
    await page.getByRole('button', { name: digit, exact: true }).click()
  await page.getByRole('button', { name: /親子で読む/ }).click()
  await expect(
    page.getByRole('button', { name: '相棒の音声をONにする' })
  ).toBeVisible()
}
test('parent reading is visibly muted, explicit replay works and voice can be enabled without restarting', async ({
  page
}) => {
  await parentTalk(page)
  expect(
    await page.evaluate(
      () => window.spoken.filter((s) => s.lang.startsWith('en')).length
    )
  ).toBe(0)
  const first = await page.locator('.bubble .say').first().innerText()
  await page
    .getByRole('button', { name: 'もういちど きく', exact: true })
    .first()
    .click()
  await expect
    .poll(() =>
      page.evaluate(
        () => window.spoken.filter((s) => s.lang.startsWith('en')).at(-1)?.text
      )
    )
    .toBe(first)
  await page.getByRole('button', { name: '相棒の音声をONにする' }).click()
  await expect(
    page.getByRole('button', { name: '相棒の音声をOFFにする' })
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.getByText(/おうちのひとが .*セリフを よんでね/)
  ).toHaveCount(0)
  const input = page.getByPlaceholder('えいごで かいてね')
  if (!(await input.isVisible()))
    await page.getByRole('button', { name: /もじ/ }).click()
  await input.fill('I like cats.')
  await page.getByRole('button', { name: 'おくる', exact: true }).click()
  await expect(page.locator('.bubble .say')).toHaveCount(2)
  const response = await page.locator('.bubble .say').last().innerText()
  await expect
    .poll(() =>
      page.evaluate(
        () => window.spoken.filter((s) => s.lang.startsWith('en')).at(-1)?.text
      )
    )
    .toBe(response)
  await page.getByRole('button', { name: '相棒の音声をOFFにする' }).click()
  const before = await page.evaluate(
    () => window.spoken.filter((s) => s.lang.startsWith('en')).length
  )
  await input.fill('I like dogs.')
  await page.getByRole('button', { name: 'おくる', exact: true }).click()
  await expect(page.locator('.bubble .say')).toHaveCount(3)
  expect(
    await page.evaluate(
      () => window.spoken.filter((s) => s.lang.startsWith('en')).length
    )
  ).toBe(before)
})
test('failed device replay gives an actionable message instead of silent success', async ({
  page
}) => {
  await parentTalk(page, { fail: true })
  await page
    .getByRole('button', { name: 'もういちど きく', exact: true })
    .first()
    .click()
  await expect(
    page.getByRole('status').filter({ hasText: '音声を再生できませんでした' })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'もういちど きく', exact: true }).first()
  ).toBeEnabled()
})

test('normal child conversation starts with automatic speech enabled', async ({
  page
}) => {
  await parentTalk(page, { parent: false })
  await expect(
    page.getByRole('button', { name: '相棒の音声をOFFにする' })
  ).toHaveAttribute('aria-pressed', 'true')
  const opener = await page.locator('.bubble .say').first().innerText()
  await expect
    .poll(() =>
      page.evaluate(
        () => window.spoken.filter((s) => s.lang.startsWith('en')).at(-1)?.text
      )
    )
    .toBe(opener)
})
