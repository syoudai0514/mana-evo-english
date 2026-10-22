import { test, expect } from '@playwright/test'
import { STATE_KEY } from '../../src/lib/state.js'
import {
  initialAdultStore,
  newAdult,
  withAdult,
  ADULT_KEY
} from '../../src/lib/adult.js'

async function seedAdult(page, { cards = 0 } = {}) {
  const adult = newAdult({ name: 'Test learner' })
  adult.cards = Array.from({ length: cards }, (_, index) => ({
    id: `c${index}`,
    en: `This is example ${index}.`,
    ja: `例文 ${index}`,
    due: Date.now() - 1000,
    interval: 0,
    reps: 0,
    lapses: 0
  }))
  const store = {
    ...withAdult(initialAdultStore(), adult),
    current: adult.id,
    pinRequired: false
  }
  await page.addInitScript(
    ({ key, store }) => {
      if (!JSON.parse(localStorage.getItem(key) || '{}').order?.length)
        localStorage.setItem(key, JSON.stringify(store))
    },
    { key: ADULT_KEY, store }
  )
  await page.goto('/?mock=1')
  await page.getByRole('button', { name: /Test learner/ }).click()
}

async function newKid(page) {
  await page.addInitScript(() => localStorage.setItem('mee-keys', '1'))
  await page.goto('/?mock=1')
  await page.getByRole('button', { name: /あいぼうを えらぶ/ }).click()
  await page.getByLabel('あだな').fill('そら')
  await page.getByRole('button', { name: 'はじめる！', exact: true }).click()
}

test('child can start, learn a letter, and retain the discovery after reload', async ({
  page
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await newKid(page)
  await expect(
    page.getByRole('button', { name: 'おはなし する！' })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /おはなしづくり|せかいのともだち/ })
  ).toHaveCount(0)
  await page.getByRole('button', { name: /きょうの もじ/ }).click()
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).letter.played,
        STATE_KEY
      )
    )
    .toBe(true)
  await page.reload()
  await expect(
    page.getByRole('button', { name: /きょうの もじ ✅/ })
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('adult starts without a child profile, creates PIN, reaches login, and keeps focus', async ({
  page
}) => {
  await page.goto('/?mock=1')
  await page.getByRole('button', { name: /大人の学習をはじめる/ }).click()
  await page.getByLabel('よび名', { exact: true }).fill('ゆう')
  await page.getByLabel(/TOEIC 目標/).fill('999')
  await expect(
    page.getByRole('button', { name: /学習スペースをつくる/ })
  ).toBeDisabled()
  await page.getByLabel(/TOEIC 目標/).fill('730')
  await page.getByRole('button', { name: /学習スペースをつくる/ }).click()
  await expect(page.getByText('保護者PINを決める（4けた）')).toBeVisible()
  for (const phase of [0, 1]) {
    for (const digit of ['1', '2', '3', '4'])
      await page.getByRole('button', { name: digit, exact: true }).click()
    if (phase === 0)
      await expect(page.getByText('もう一度入力してください')).toBeVisible()
  }
  await page.getByRole('button', { name: 'TOEIC 対策', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'TOEIC の学習へ', exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: '学習とログインの設定' }).click()
  await expect(page.getByLabel('メールアドレス')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /🌿ゆう|🌿 ゆう/ }).click()
  await expect(page.getByText('保護者PINを入力', { exact: true })).toBeVisible()
  for (const digit of ['1', '2', '3', '4'])
    await page.getByRole('button', { name: digit, exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'TOEIC 対策', exact: true })
  ).toHaveAttribute('aria-pressed', 'true')
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).profile,
      STATE_KEY
    )
  ).toBeNull()
})

test('short plan review preserves the displayed six-card limit and records review-only day', async ({
  page
}) => {
  await seedAdult(page, { cards: 12 })
  await page.getByRole('button', { name: /言い方を復習\s*6枚/ }).click()
  await expect(page.locator('.top')).toContainText('1/6')
  for (let index = 0; index < 6; index++) {
    await page.getByRole('button', { name: '答えを見る', exact: true }).click()
    await page.getByRole('button', { name: /言えた/ }).click()
  }
  await expect(page.getByText(/復習 6枚/)).toBeVisible()
  await page.getByRole('button', { name: 'ホームへ', exact: true }).click()
  await expect(page.locator('.week-day.today')).toHaveClass(/complete/)
})

test('TOEIC check completes ten questions and saves answers without claiming official score', async ({
  page
}) => {
  await seedAdult(page)
  await page.getByRole('button', { name: 'TOEIC 対策', exact: true }).click()
  await page
    .getByRole('button', { name: 'TOEIC の学習へ', exact: true })
    .click()
  await expect(page.getByText(/全7パートの模試ではありません/)).toBeVisible()
  await page.getByRole('button', { name: /基礎チェックをはじめる/ }).click()
  for (let index = 0; index < 10; index++) {
    await expect(page.locator('.top')).toContainText(`${index + 1}/10`)
    await page.locator('.qopt').first().click()
    await expect(page.locator('.explain')).toBeVisible()
    await page
      .getByRole('button', {
        name: index === 9 ? 'おわり ▶' : 'つぎへ ▶',
        exact: true
      })
      .click()
  }
  await expect(page.getByText(/本番スコアの予測ではありません/)).toBeVisible()
  const answers = await page.evaluate((key) => {
    const store = JSON.parse(localStorage.getItem(key))
    return store.adults[store.current].answers.length
  }, ADULT_KEY)
  expect(answers).toBe(10)
})

test('child mock conversation produces a saved session on exit', async ({
  page
}) => {
  await newKid(page)
  await page.getByRole('button', { name: 'おはなし する！' }).click()
  const input = page.getByPlaceholder('えいごで かいてね')
  if (!(await input.isVisible()))
    await page.getByRole('button', { name: /もじ/ }).click()
  await input.fill('I like cats.')
  await page.getByRole('button', { name: 'おくる', exact: true }).click()
  await expect(page.getByText('I like cats.', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'おくる', exact: true })
  ).toBeEnabled()
  await page.getByRole('button', { name: 'おわる', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).sessions.length,
        STATE_KEY
      )
    )
    .toBe(1)
})

for (const width of [320, 390, 768, 1280]) {
  test(`entry, child and adult homes fit ${width}px without horizontal overflow`, async ({
    page
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/?mock=1')
    await expect(
      page.getByRole('heading', { name: /毎日を変える/ })
    ).toBeVisible()
    const check = async () => {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
      expect(
        await page
          .locator('.scroll')
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
      ).toBe(true)
    }
    await check()
    await newKid(page)
    await check()
    await page.screenshot({ path: `test-results/kid-${width}.png` })
    await seedAdult(page)
    await check()
    await page.screenshot({ path: `test-results/adult-${width}.png` })
  })
}
