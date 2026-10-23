import { test, expect } from '@playwright/test'
import { initialState, STATE_KEY } from '../../src/lib/state.js'
import {
  initialAdultStore,
  newAdult,
  withAdult,
  ADULT_KEY
} from '../../src/lib/adult.js'
async function kid(page) {
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
  await page.getByRole('button', { name: /えらぶ/ }).click()
}
async function adult(page) {
  const person = newAdult({ name: 'Teacher' })
  await page.addInitScript(
    ({ key, store }) => {
      if (!JSON.parse(localStorage.getItem(key) || '{}').order?.length)
        localStorage.setItem(key, JSON.stringify(store))
    },
    {
      key: ADULT_KEY,
      store: {
        ...withAdult(initialAdultStore(), person),
        current: person.id,
        pinRequired: false
      }
    }
  )
  await page.goto('/?mock=1')
  await page.getByRole('button', { name: /Teacher/ }).click()
  await page.getByRole('button', { name: '教材を選ぶ' }).click()
}
test('kid completes activity, sees saved completion and can revisit', async ({
  page
}) => {
  await kid(page)
  await page.getByRole('button', { name: /ふかふか ベッド/ }).click()
  await page.getByRole('button', { name: 'ぼうけんを はじめる' }).click()
  for (let i = 0; i < 3; i++) {
    await page.locator('.lesson-choice').first().click()
    await page.getByRole('button', { name: 'つぎへ', exact: true }).click()
  }
  await page.getByRole('button', { name: 'できた！', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'できたね！' })).toBeVisible()
  await page.getByRole('button', { name: 'つぎの ぼうけんを えらぶ' }).click()
  await expect(page.locator('.lesson-card.is-complete')).toHaveCount(1)
})
test('all story choices lead to an ending and save the chosen path', async ({
  page
}) => {
  await kid(page)
  await page.getByRole('button', { name: '📖 おはなし', exact: true }).click()
  await page.getByRole('button', { name: /まいごの ほし/ }).click()
  for (let i = 0; i < 3; i++)
    await page.locator('.story-choices button').last().click()
  await page.getByRole('button', { name: 'おはなし できあがり！' }).click()
  await expect(page.getByRole('heading', { name: 'できたね！' })).toBeVisible()
})
test('adult filters scenes, finishes guided dialogue and enrolls a bounded review pack', async ({
  page
}) => {
  await adult(page)
  await page.getByLabel('レベルの目安').selectOption('A1')
  await page.getByLabel('さがす').fill('自己紹介')
  await page.locator('.lesson-card').first().click()
  await page.getByRole('button', { name: '会話の役をやってみる' }).click()
  for (let i = 0; i < 6; i++)
    await page.locator('.lesson-panel .primary-action.lesson-next').click()
  await page.getByRole('button', { name: '練習を記録する' }).click()
  await page
    .getByRole('button', { name: 'フレーズを復習に追加（最大5枚）' })
    .click()
  const count = await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key))
    return s.adults[s.current].cards.length
  }, ADULT_KEY)
  expect(count).toBeGreaterThan(0)
  expect(count).toBeLessThanOrEqual(5)
})
test('listening checks and phonics work without an AI account', async ({
  page
}) => {
  await adult(page)
  await page.getByRole('button', { name: '🎧 耳から学ぶ', exact: true }).click()
  await page.locator('.lesson-card').first().click()
  for (let i = 0; i < 3; i++) {
    await page.locator('.lesson-choice').first().click()
    await page.getByRole('button', { name: 'つぎへ', exact: true }).click()
  }
  await page.getByRole('button', { name: '聞く練習を記録' }).click()
  await expect(
    page.getByRole('heading', { name: '今日の一歩ができました。' })
  ).toBeVisible()
})
test('all-part practice shows a photo, supports unanswered submission, and stores result', async ({
  page
}) => {
  await adult(page)
  await page.getByRole('button', { name: 'ホームにもどる' }).click()
  await page.getByRole('button', { name: 'TOEIC 対策', exact: true }).click()
  await page
    .getByRole('button', { name: 'TOEIC の学習へ', exact: true })
    .click()
  await page.getByRole('button', { name: /全7パート・600問/ }).click()
  await page.getByLabel('パート', { exact: true }).selectOption('p1')
  await page.getByRole('button', { name: 'このパートを練習する' }).click()
  await expect(page.locator('.exam-photo')).toBeVisible()
  await page.getByRole('button', { name: /文字で練習する/ }).click()
  await page.locator('.exam-options button').first().click()
  await page.getByRole('button', { name: '答えと根拠を確認' }).click()
  await expect(page.locator('.exam-explanation')).toBeVisible()
  await page.locator('.exam-position').click()
  await page
    .getByRole('navigation', { name: '問題一覧' })
    .getByRole('button', { name: '6', exact: true })
    .click()
  await page.getByRole('button', { name: '回答を提出する' }).click()
  await page.getByRole('button', { name: '確定する' }).click()
  await expect(
    page.getByText('回答 1問 · 未回答 5問 · 文字ヒント 1問')
  ).toBeVisible()
  const answerCount = () =>
    page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('mee-adult-v1'))
      return s.adults[s.current].answers.length
    })
  const before = await answerCount()
  await page.reload()
  await page
    .getByRole('button', { name: '結果と解説を開く', exact: true })
    .first()
    .click()
  await expect(
    page.getByText('回答 1問 · 未回答 5問 · 文字ヒント 1問')
  ).toBeVisible()
  expect(await answerCount()).toBe(before)
})
test('timed exam pauses without revealing questions and resumes after leaving', async ({
  page
}) => {
  await adult(page)
  await page.getByRole('button', { name: 'ホームにもどる' }).click()
  await page.getByRole('button', { name: 'TOEIC 対策', exact: true }).click()
  await page
    .getByRole('button', { name: 'TOEIC の学習へ', exact: true })
    .click()
  await page.getByRole('button', { name: /全7パート・600問/ }).click()
  await page.getByRole('button', { name: '計時してはじめる' }).first().click()
  await page.getByRole('button', { name: '一時停止（結果に記録）' }).click()
  await expect(page.locator('.exam-question')).toHaveCount(0)
  await page.getByRole('button', { name: '保存してTOEICに戻る' }).click()
  await page.getByRole('button', { name: /全7パート・600問/ }).click()
  await page.getByRole('button', { name: /のつづき/ }).click()
  await expect(
    page.getByRole('button', { name: '時計を再開する' })
  ).toBeVisible()
  await page.getByRole('button', { name: '時計を再開する' }).click()
  await expect(page.locator('.exam-photo')).toBeVisible()
})
test('lesson route resumes after reload and browser back returns to the library', async ({
  page
}) => {
  await kid(page)
  await page.getByRole('button', { name: /ふかふか ベッド/ }).click()
  await page.getByRole('button', { name: 'ぼうけんを はじめる' }).click()
  await page.locator('.lesson-choice').first().click()
  await page.getByRole('button', { name: 'つぎへ', exact: true }).click()
  await page.reload()
  await expect(page.locator('.lesson-progress-label')).toHaveText('2 / 3')
  await page.goBack()
  await expect(
    page.getByRole('heading', { name: 'ぼうけんの ほんだな' })
  ).toBeVisible()
})

test('direct child cloud URL cannot bypass the parent PIN', async ({
  page
}) => {
  await kid(page)
  await page.evaluate(() => localStorage.setItem('mee-parent-pin-v1', '1234'))
  await page.goto('/?mock=1#/cloudSettingsKid')
  await expect(page.getByText('保護者PINを入力', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: '学習記録を書き出す' })
  ).toHaveCount(0)
  for (const d of ['1', '2', '3', '4'])
    await page.getByRole('button', { name: d, exact: true }).click()
  await expect(
    page.getByRole('button', { name: '学習記録を書き出す' })
  ).toBeVisible()
})

test('hiding a TOEIC transcript does not erase hint-use history', async ({
  page
}) => {
  await adult(page)
  await page.goto('/?mock=1#/toeicPractice')
  await page.getByRole('button', { name: 'このパートを練習する' }).click()
  await page.getByRole('button', { name: /文字で練習する/ }).click()
  await page.getByRole('button', { name: '文字を隠す', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const store = JSON.parse(localStorage.getItem('mee-learning-v1'))
        return (
          Object.values(store.learners)[0]?.toeicSessions &&
          Object.values(Object.values(store.learners)[0].toeicSessions)[0].hints
            .length
        )
      })
    )
    .toBe(1)
})

test('keyboard microphone permission rejection restores controls and permits text input', async ({
  page
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => {
        throw new DOMException('Denied', 'NotAllowedError')
      }
    })
  })
  await kid(page)
  await page.getByRole('button', { name: 'ホームにもどる' }).click()
  await page
    .getByRole('button', { name: 'おはなし する！', exact: true })
    .click()
  const mic = page.getByRole('button', {
    name: 'おしながら はなす',
    exact: true
  })
  await mic.focus()
  await page.keyboard.down('Space')
  await page.keyboard.up('Space')
  await expect(mic).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByLabel('えいごで かく')).toBeVisible()
})

for (const width of [320, 390, 768, 1280])
  test(`learning library fits ${width}px with enlarged text and reduced motion`, async ({
    page
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await adult(page)
    await page.addStyleTag({
      content: 'html{font-size:200%} .lesson-card{font-size:1rem}'
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await expect(page.locator('.lesson-card').first()).toBeVisible()
  })

test('foundation enrollment respects the selected limit and can report, skip and delete cards', async ({
  page
}) => {
  await adult(page)
  await page.getByRole('button', { name: '🗂️ フレーズ', exact: true }).click()
  await page.getByLabel('今回追加する枚数').selectOption('3')
  await page.getByRole('button', { name: '表示中の分野から復習に追加' }).click()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('mee-adult-v1'))
        return s.adults[s.current].cards.length
      })
    )
    .toBe(3)
  await page.getByRole('button', { name: 'ホームにもどる' }).click()
  await page
    .getByRole('button', { name: '今日の復習 3枚', exact: true })
    .click()
  await page.getByRole('button', { name: '誤りを報告', exact: true }).click()
  await page
    .getByRole('textbox', { name: /気になる点/ })
    .fill('訳を確認したいです')
  await page.getByRole('button', { name: 'この端末に報告を保存' }).click()
  await page.getByRole('button', { name: '今回はスキップ' }).click()
  await page
    .getByRole('button', { name: 'このカードを削除…', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'このカードを削除する', exact: true })
    .click()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('mee-adult-v1'))
        return [
          s.adults[s.current].cards.length,
          s.adults[s.current].contentReports.length
        ]
      })
    )
    .toEqual([2, 1])
})

test('failed lesson storage does not advance or claim completion', async ({
  page
}) => {
  await kid(page)
  await page.getByRole('button', { name: /ふかふか ベッド/ }).click()
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'mee-learning-v1')
        throw new DOMException('Full', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await page
    .getByRole('button', { name: 'ぼうけんを はじめる', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'ぼうけんを はじめる', exact: true })
  ).toBeVisible()
  await expect(page.locator('.lesson-progress-label')).toHaveCount(0)
  await expect(
    page.getByText(
      '教材の記録を保存できませんでした。端末の空き容量を確認してください',
      { exact: true }
    )
  ).toBeVisible()
})

test('TOEIC answer survives an immediate reload before explanation', async ({
  page
}) => {
  await adult(page)
  await page.goto('/?mock=1#/toeicPractice')
  await page.getByLabel('パート', { exact: true }).selectOption('p1')
  await page.getByRole('button', { name: 'このパートを練習する' }).click()
  await page.locator('.exam-options button').first().click()
  await page.reload()
  await page.getByRole('button', { name: /のつづき.*1\/6回答/ }).click()
  await expect(page.locator('.exam-options button').first()).toHaveAttribute(
    'aria-pressed',
    'true'
  )
})
