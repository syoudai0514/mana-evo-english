import test from 'node:test'
import assert from 'node:assert/strict'
import { toHiragana, nextReading, readingText } from '../src/lib/kana.js'
import { downsample, encodeWav, rms } from '../src/lib/wav.js'
import {
  initialState, withStreak, streakCount, withUtterance, withMemory, withSessionEnd,
  modelToday, withModelResult, todaySummary, normalizePhrase, friendshipView
} from '../src/lib/state.js'
import { suggestLevel, levelOf } from '../src/data/levels.js'
import { buildSystemPrompt, buildHistory, selectMemory } from '../src/data/prompt.js'
import { pickTopic, topicsForDate, TOPICS } from '../src/data/topics.js'
import { SCENES, rollScene } from '../src/data/scenes.js'
import { pickSecret } from '../src/data/guess.js'

test('kana: katakana reading becomes hiragana and cycles', () => {
  assert.equal(toHiragana('アイ ライク ドッグズ！'), 'あい らいく どっぐず！')
  assert.equal(toHiragana('ハロウィーン'), 'はろうぃーん')
  assert.equal(nextReading('hira'), 'kata')
  assert.equal(nextReading('kata'), 'none')
  assert.equal(nextReading('none'), 'hira')
  assert.equal(readingText('ドッグ', 'none'), '')
  assert.equal(readingText('ドッグ', 'kata'), 'ドッグ')
})

test('wav: 16kHz mono PCM header and downsampling', () => {
  const input = new Float32Array(48000).fill(0.5)
  const pcm = downsample(input, 48000, 16000)
  assert.equal(pcm.length, 16000)
  const bytes = encodeWav(pcm, 16000)
  const view = new DataView(bytes.buffer)
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'RIFF')
  assert.equal(String.fromCharCode(...bytes.slice(8, 12)), 'WAVE')
  assert.equal(view.getUint16(22, true), 1)
  assert.equal(view.getUint32(24, true), 16000)
  assert.equal(bytes.length, 44 + 16000 * 2)
  assert.ok(Math.abs(rms(input) - 0.5) < 1e-6)
})

test('streak counts consecutive days and resets after a gap', () => {
  let state = initialState()
  state = withStreak(state, new Date('2026-10-15T09:00:00'))
  state = withStreak(state, new Date('2026-10-16T09:00:00'))
  state = withStreak(state, new Date('2026-10-16T20:00:00'))
  assert.equal(state.streak.count, 2)
  assert.equal(streakCount(state, new Date('2026-10-17T08:00:00')), 2)
  assert.equal(streakCount(state, new Date('2026-10-19T08:00:00')), 0)
  state = withStreak(state, new Date('2026-10-19T09:00:00'))
  assert.equal(state.streak.count, 1)
})

test('level rises from English answers but never above 4 automatically', () => {
  assert.equal(suggestLevel(1, Array(11).fill({ english: true, words: 5 })), 1)
  assert.equal(suggestLevel(1, Array(20).fill({ english: false, words: 0 })), 1)
  const half = Array.from({ length: 20 }, (_, i) => ({ english: i % 2 === 0, words: 2 }))
  assert.equal(suggestLevel(1, half), 3)
  assert.equal(suggestLevel(1, Array(20).fill({ english: true, words: 6 })), 4)
  assert.equal(suggestLevel(5, Array(20).fill({ english: false, words: 0 })), 5)
  let state = initialState()
  for (let i = 0; i < 14; i += 1) state = withUtterance(state, { english: true, text: 'I like big dogs' })
  assert.equal(state.level, 4)
})

test('memory dedupes and keeps the newest facts', () => {
  let state = initialState()
  state = withMemory(state, ['likes dinosaurs', 'Likes dinosaurs', ''], 'howamy')
  assert.equal(state.memory.length, 1)
  for (let i = 0; i < 50; i += 1) state = withMemory(state, [`fact ${i}`], 'niji')
  assert.equal(state.memory.length, 40)
  assert.equal(state.memory.at(-1).fact, 'fact 49')
  const picked = selectMemory(state.memory, () => 0)
  assert.equal(picked.length, 8)
  assert.equal(picked.at(-1), 'fact 49')
})

test('session end records phrases, first-time phrases, sticker and friendship', () => {
  const session = {
    id: 's1', mode: 'free', partner: 'howamy', title: 'かぼちゃ', emoji: '🎃', topicId: 'pumpkin',
    startedAt: '2026-10-17T09:00:00.000Z',
    turns: [
      { who: 'partner', text: 'Do you like pumpkins?' },
      { who: 'child', text: 'Yes! Halloween!', english: true },
      { who: 'partner', text: 'What do you want to be?' },
      { who: 'child', text: 'きょうりゅう', english: false, recast: 'I want to be a dinosaur.' },
      { who: 'partner', text: 'Cool!' },
      { who: 'child', text: 'Roar!', english: true }
    ]
  }
  const date = new Date('2026-10-17T09:06:00.000Z')
  const { state, record, completed } = withSessionEnd(initialState(), session, { date, random: () => 0 })
  assert.equal(completed, true)
  assert.deepEqual(record.said, ['Yes! Halloween!', 'Roar!'])
  assert.deepEqual(record.newPhrases, ['Yes! Halloween!', 'Roar!'])
  assert.equal(state.stickers.length, 1)
  assert.equal(state.friendship.howamy, 1)
  assert.deepEqual(state.recentTopics, ['pumpkin'])
  assert.equal(state.phrasesSaid[normalizePhrase('Yes! Halloween!')], 1)

  const again = withSessionEnd(state, { ...session, id: 's2' }, { date, random: () => 0 })
  assert.deepEqual(again.record.newPhrases, [])
  assert.notEqual(again.state.stickers[1].emoji, again.state.stickers[0].emoji)

  const summary = todaySummary(again.state, date)
  assert.equal(summary.sessions, 2)
  assert.equal(summary.childTurns, 6)
  assert.equal(summary.englishTurns, 4)
})

test('short sessions do not give stickers', () => {
  const session = { mode: 'free', partner: 'niji', startedAt: new Date().toISOString(), turns: [{ who: 'child', text: 'Hi', english: true }] }
  const { state, completed } = withSessionEnd(initialState(), session)
  assert.equal(completed, false)
  assert.equal(state.stickers.length, 0)
  assert.equal(state.friendship.niji, 0)
})

test('model fallback state resets each day and remembers exhaustion', () => {
  const day1 = new Date('2026-10-17T10:00:00')
  let state = withModelResult(initialState(), { modelIndex: 1 }, day1)
  assert.equal(modelToday(state, day1).startIndex, 1)
  state = withModelResult(state, { exhausted: true }, day1)
  assert.equal(modelToday(state, day1).done, true)
  assert.deepEqual(modelToday(state, new Date('2026-10-18T07:00:00')), { date: '2026-10-18', startIndex: 0, done: false })
})

test('friendship hearts roll over into ranks', () => {
  assert.deepEqual(friendshipView(0), { rank: 1, hearts: 0 })
  assert.deepEqual(friendshipView(7), { rank: 2, hearts: 2 })
})

test('system prompt adapts to mode, stage and memory', () => {
  const topic = TOPICS.find((item) => item.id === 'pumpkin')
  const base = { persona: 'howamy', nickname: 'そうちゃん', memory: ['likes dinosaurs'], turn: 2, maxTurns: 10 }
  const free = buildSystemPrompt({ ...base, mode: 'free', level: 1, topic })
  assert.match(free, /Howamy/)
  assert.match(free, /そうちゃん/)
  assert.match(free, /Stage 1/)
  assert.match(free, /understand Japanese/)
  assert.match(free, /likes dinosaurs/)
  assert.match(free, /I found a big pumpkin/)

  const advanced = buildSystemPrompt({ ...base, mode: 'free', level: 5, topic, persona: 'niji' })
  assert.match(advanced, /Niji/)
  assert.match(advanced, /Can you tell me in English/)

  const scene = SCENES[0]
  const play = buildSystemPrompt({ ...base, mode: 'play', level: 2, play: { scene, ...rollScene(scene, () => 0) } })
  assert.match(play, /Pretend Play at "Ice Cream Shop"/)

  const secret = pickSecret('food', () => 0)
  const guessEasy = buildSystemPrompt({ ...base, mode: 'guess', level: 2, secret })
  assert.match(guessEasy, /a banana/)
  assert.match(guessEasy, /Give ONE simple clue/)
  const guessHard = buildSystemPrompt({ ...base, mode: 'guess', level: 4, secret })
  assert.match(guessHard, /yes\/no questions/)

  const adult = buildSystemPrompt({ mode: 'adult', adultScene: { about: 'travel', opener: 'Hi' }, turn: 1, maxTurns: 16 })
  assert.match(adult, /tip_ja/)
  assert.doesNotMatch(adult, /child \(about 5-6/)
})

test('history keeps only recent turns as plain text', () => {
  const turns = Array.from({ length: 12 }, (_, i) => ({ who: i % 2 ? 'child' : 'partner', text: `t${i}` }))
  const history = buildHistory(turns, 8)
  assert.equal(history.length, 8)
  assert.deepEqual(history[0], { role: 'model', text: 't4' })
  assert.deepEqual(history.at(-1), { role: 'user', text: 't11' })
})

test('topics respect seasons and avoid recent ones', () => {
  const october = new Date('2026-10-17T09:00:00')
  assert.ok(topicsForDate(october).some((topic) => topic.id === 'pumpkin'))
  assert.ok(!topicsForDate(october).some((topic) => topic.id === 'snow'))
  const recentIds = topicsForDate(october).map((topic) => topic.id).filter((id) => id !== 'cars')
  assert.equal(pickTopic({ date: october, recentIds }).id, 'cars')
  for (const topic of TOPICS) {
    assert.ok(topic.opener.en && topic.opener.kana && topic.opener.ja, topic.id)
  }
  assert.ok(levelOf(9).level === 1)
})

test('live prompts: short voice replies, katakana English, screen card only when enabled', async () => {
  const { buildLiveSystemPrompt } = await import('../src/data/prompt.js')
  const topic = TOPICS.find((item) => item.id === 'pumpkin')
  const base = { mode: 'free', persona: 'niji', level: 1, nickname: 'そうちゃん', topic, memory: ['likes soccer'], maxTurns: 10 }
  const live = buildLiveSystemPrompt(base)
  assert.match(live, /OUT LOUD/)
  assert.match(live, /at most 10 words/)
  assert.match(live, /チーズ/)
  assert.match(live, /Never make the child repeat/)
  assert.match(live, /likes soccer/)
  assert.doesNotMatch(live, /show_card/)
  assert.match(buildLiveSystemPrompt({ ...base, withCard: true }), /call the function show_card/)
  const adult = buildLiveSystemPrompt({ mode: 'adult', adultScene: { about: 'travel', opener: 'Hi' }, maxTurns: 16 })
  assert.doesNotMatch(adult, /tip_ja/)
})

test('pcm helpers round-trip 16-bit audio', async () => {
  const { floatToPcm16Base64, pcm16Base64ToFloat } = await import('../src/lib/wav.js')
  const input = new Float32Array([0, 0.5, -0.5, 0.25])
  const back = pcm16Base64ToFloat(floatToPcm16Base64(input))
  assert.equal(back.length, 4)
  for (let i = 0; i < 4; i += 1) assert.ok(Math.abs(back[i] - input[i]) < 1e-3)
})
