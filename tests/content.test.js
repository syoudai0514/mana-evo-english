import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CONTENT,
  validateContent,
  KID_ACTIVITIES,
  CONVERSATION_LESSONS,
  PHONICS_ITEMS,
  PHRASE_PACK,
  SHADOW_PACK,
  STORIES,
  WORLD_FRIENDS,
  LISTENING_LESSONS
} from '../src/content/index.js'
import {
  initialLearning,
  completeLesson,
  saveLessonDraft,
  learnerProgress,
  importedCards
} from '../src/lib/learning.js'
import { newAdult } from '../src/lib/adult.js'

test('catalog has complete target quantities and valid references, metadata and reachable story endings', () => {
  assert.deepEqual(validateContent(), [])
  for (const [items, count] of [
    [KID_ACTIVITIES, 60],
    [CONVERSATION_LESSONS, 216],
    [PHONICS_ITEMS, 110],
    [PHRASE_PACK, 240],
    [SHADOW_PACK, 60],
    [STORIES, 24],
    [WORLD_FRIENDS, 12],
    [LISTENING_LESSONS, 36]
  ])
    assert.equal(items.length, count)
  assert.equal(KID_ACTIVITIES.flatMap((i) => i.phrases).length, 300)
  assert.equal(new Set(CONTENT.map((i) => i.id)).size, CONTENT.length)
  assert.equal(new Set(CONVERSATION_LESSONS.map((i) => i.sceneId)).size, 72)
  for (const sceneId of new Set(CONVERSATION_LESSONS.map((i) => i.sceneId)))
    assert.deepEqual(
      CONVERSATION_LESSONS.filter((i) => i.sceneId === sceneId).map(
        (i) => i.level
      ),
      ['A1', 'A2', 'B1']
    )
  assert.equal(LISTENING_LESSONS.flatMap((i) => i.checks).length, 108)
  assert.ok(CONTENT.every((i) => i.review.status === 'draft'))
})
test('learner drafts resume and completion belongs only to its learner', () => {
  const item = KID_ACTIVITIES[0]
  let store = saveLessonDraft(initialLearning(), 'kid:one', item.id, {
    index: 2
  })
  assert.equal(learnerProgress(store, 'kid:one').drafts[item.id].index, 2)
  store = completeLesson(
    store,
    'kid:one',
    item,
    { answers: { 0: 1 } },
    new Date(2026, 9, 22, 12)
  )
  assert.equal(
    learnerProgress(store, 'kid:one').completed[item.id].day,
    '2026-10-22'
  )
  assert.equal(learnerProgress(store, 'kid:one').drafts[item.id], undefined)
  assert.deepEqual(learnerProgress(store, 'adult:two').completed, {})
})
test('foundation enrollment is capped and deduplicates conversations with the same phrase', () => {
  let adult = newAdult()
  adult = importedCards(adult, PHRASE_PACK, { limit: 5 })
  assert.equal(adult.cards.length, 5)
  adult = importedCards(adult, PHRASE_PACK.slice(0, 5), { limit: 10 })
  assert.equal(adult.cards.length, 5)
  assert.ok(adult.cards.every((i) => i.source === 'foundation' && i.due > 0))
})

test('review and shadow packs cover the required six fields without evicting personal cards', () => {
  for (const category of [
    'daily',
    'work',
    'travel',
    'parenting',
    'repair',
    'opinion'
  ]) {
    assert.equal(PHRASE_PACK.filter((p) => p.category === category).length, 40)
    assert.equal(SHADOW_PACK.filter((p) => p.category === category).length, 10)
  }
  for (const level of ['A1', 'A2', 'B1'])
    assert.equal(SHADOW_PACK.filter((p) => p.level === level).length, 20)
  const adult = newAdult()
  adult.cards = Array.from({ length: 400 }, (_, i) => ({
    id: `mine${i}`,
    en: `My sentence ${i}`
  }))
  assert.deepEqual(
    importedCards(adult, PHRASE_PACK, { limit: 10 }).cards,
    adult.cards
  )
})
