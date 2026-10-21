import test from 'node:test'
import assert from 'node:assert/strict'
import {
  weekTrail,
  kidLearningDays,
  adultLearningDays,
  validToeicTarget
} from '../src/lib/journey.js'
import { initialState, saveState, withLetterPlayed } from '../src/lib/state.js'
import {
  newAdult,
  withStudyDay,
  loadAdultStore,
  ADULT_KEY
} from '../src/lib/adult.js'

test('week trail crosses month boundaries and counts each actual calendar day once', () => {
  const week = weekTrail(
    ['2026-09-30', '2026-09-30', '2026-10-02'],
    new Date(2026, 9, 2, 9)
  )
  assert.equal(week.length, 7)
  assert.equal(week[0].key, '2026-09-26')
  assert.equal(week.at(-1).key, '2026-10-02')
  assert.equal(week.filter((day) => day.done).length, 2)
  assert.equal(week.filter((day) => day.today).length, 1)
})

test('a letter counts as a small learning step without claiming a conversation', () => {
  const state = withLetterPlayed(initialState(), new Date(2026, 9, 21, 12))
  assert.deepEqual([...new Set(kidLearningDays(state))], ['2026-10-21'])
  assert.equal(state.sessions.length, 0)
})

test('review-only days are persisted, deduped, and visible in the weekly trail', () => {
  let adult = newAdult()
  adult = withStudyDay(adult, new Date(2026, 9, 20, 12))
  adult = withStudyDay(adult, new Date(2026, 9, 21, 12))
  adult = withStudyDay(adult, new Date(2026, 9, 21, 13))
  assert.deepEqual(adult.studyDays, ['2026-10-20', '2026-10-21'])
  assert.equal(adult.streak.count, 2)
  assert.equal(
    weekTrail(adultLearningDays(adult), new Date(2026, 9, 21)).filter(
      (day) => day.done
    ).length,
    2
  )
})

test('older adult saves gain focus and history without losing cards or profile', () => {
  const saved = {
    id: 'old',
    name: 'Example',
    target: 730,
    cards: [{ id: 'keep' }]
  }
  const store = loadAdultStore({
    getItem: (key) =>
      key === ADULT_KEY
        ? JSON.stringify({
            adults: { old: saved },
            order: ['old'],
            current: 'old'
          })
        : null
  })
  assert.equal(store.adults.old.focus, 'speak')
  assert.deepEqual(store.adults.old.studyDays, [])
  assert.deepEqual(store.adults.old.cards, [{ id: 'keep' }])
  assert.equal(store.current, 'old')
})

test('TOEIC target accepts the score scale, rejects invalid input', () => {
  for (const value of ['10', '600', '730', 990])
    assert.equal(validToeicTarget(value), true)
  for (const value of ['', 'abc', 0, 991, 999, 731, 600.5, null])
    assert.equal(validToeicTarget(value), false)
})

test('child save failures are observable instead of silently claiming success', () => {
  assert.equal(
    saveState(initialState(), {
      setItem: () => {
        throw new Error('QuotaExceededError')
      }
    }),
    false
  )
  assert.equal(saveState(initialState(), null), false)
  const saved = new Map()
  assert.equal(
    saveState(initialState(), {
      setItem: (key, value) => saved.set(key, value)
    }),
    true
  )
  assert.equal(saved.size, 1)
})

test('learning another letter tomorrow preserves the earlier learning day', () => {
  const first = withLetterPlayed(initialState(), new Date(2026, 9, 20, 12))
  const second = withLetterPlayed(first, new Date(2026, 9, 21, 12))
  assert.equal(
    weekTrail(kidLearningDays(second), new Date(2026, 9, 21)).filter(
      (day) => day.done
    ).length,
    2
  )
})
