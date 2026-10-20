import test from 'node:test'
import assert from 'node:assert/strict'
import { toHiragana, nextReading, readingText, cleanEmoji, tidyKidsJa } from '../src/lib/kana.js'
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

test('level rises only from spoken English over 3+ days, never above 4, and steps down when too hard', () => {
  const days = (n) => Array.from({ length: n }, (_, i) => `2026-10-${String(10 + (i % 3)).padStart(2, '0')}`)
  const make = (n, fn) => days(n).map((day, i) => ({ day, ...fn(i) }))
  assert.equal(suggestLevel(1, make(11, () => ({ english: true, words: 5 }))), 1)
  assert.equal(suggestLevel(1, make(20, () => ({ english: false, words: 0 }))), 1)
  assert.equal(suggestLevel(1, make(20, (i) => ({ english: i % 2 === 0, words: 2 }))), 3)
  assert.equal(suggestLevel(1, make(20, () => ({ english: true, words: 6 }))), 4)
  assert.equal(suggestLevel(5, make(20, () => ({ english: false, words: 0 }))), 5)
  // 1日だけたくさん話しても上がらない
  assert.equal(suggestLevel(1, Array(20).fill({ english: true, words: 6, day: '2026-10-10' })), 1)
  // ヒントをタップしただけでは上がらない
  assert.equal(suggestLevel(1, make(20, () => ({ english: true, words: 3, hint: true }))), 1)
  let state = initialState()
  for (let i = 0; i < 14; i += 1) state = withUtterance(state, { english: true, text: 'I like big dogs' }, new Date(2026, 9, 10 + (i % 3), 9))
  assert.equal(state.level, 4)
  for (let i = 0; i < 8; i += 1) state = withUtterance(state, { english: false, text: 'わかんない', dk: i % 2 === 0 }, new Date(2026, 9, 14, 9))
  assert.equal(state.level, 3)
  assert.ok(state.levelDownAt)
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
  // シールは1日1まい。次の日はもらえて、ちがうシール
  assert.equal(again.state.stickers.length, 1)
  assert.equal(again.record.stickerToday, true)
  const nextDay = withSessionEnd(again.state, { ...session, id: 's3' }, { date: new Date('2026-10-18T09:06:00.000Z'), random: () => 0 })
  assert.notEqual(nextDay.state.stickers[1].emoji, nextDay.state.stickers[0].emoji)
  assert.equal(nextDay.state.daysTalked, 2)
  assert.equal(nextDay.state.letter.played, true)

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

test('broken hint emoji is rebuilt from its code point or hidden', () => {
  assert.equal(cleanEmoji('🛝', ''), '🛝')
  assert.equal(cleanEmoji('����', '1F6DD'), '🛝')
  assert.equal(cleanEmoji('��', 'U+1F3A0'), '🎠')
  assert.equal(cleanEmoji('��', ''), '')
  assert.equal(cleanEmoji('', '0041'), '')
})

test('kid Japanese drops spaces before punctuation', () => {
  assert.equal(tidyKidsJa('なあに マサキ 。 おはな の ゆめ かな ？ おしえて ！'), 'なあに マサキ。 おはな の ゆめ かな？ おしえて！')
})

test('annotator cards for an older line are recognized', async () => {
  const { sameLine } = await import('../src/lib/annotator.js')
  const now = "It really is relaxing, isn't it? I love just watching the clouds. Do you have a favorite park near your house?"
  assert.equal(sameLine(now, now), true)
  assert.equal(sameLine("It really is relaxing isn't it? I love watching the clouds. Do you have a favorite park near your house?", now), true)
  assert.equal(sameLine("It's okay! Sometimes it's hard to catch everything. Are you just enjoying the fresh air?", now), false)
})

test('adult memory is parsed by category and deduped', async () => {
  const { newAdult, withAdultMemory, greetingFor } = await import('../src/lib/adult.js')
  let adult = newAdult({}, new Date('2026-10-18T10:00:00'))
  adult = withAdultMemory(adult, ['work: the release was pushed back to next month', 'family: wants to take his son to the park', 'work: the release was pushed back to next month'])
  assert.equal(adult.memory.length, 2)
  assert.equal(adult.memory[0].cat, 'work')
  assert.match(greetingFor(adult, new Date('2026-10-18T21:00:00')).en, /^Evening! Last time you told me wants to take/)
})

test('review cards follow again/hard/good spacing', async () => {
  const { newAdult, withCards, scheduleCard, dueCards, nextLabel } = await import('../src/lib/adult.js')
  const now = new Date('2026-10-18T10:00:00')
  let adult = withCards(newAdult({}, now), [{ en: 'push back', ja: '延期する' }, { en: 'Push back', ja: '重複' }], 'chat', now)
  assert.equal(adult.cards.length, 1)
  const card = adult.cards[0]
  assert.equal(dueCards(adult, now.getTime()).length, 1)
  assert.equal(nextLabel(card, 'again', now.getTime()), '10分後')
  assert.equal(nextLabel(card, 'hard', now.getTime()), 'あした')
  assert.equal(nextLabel(card, 'good', now.getTime()), '4日後')
  assert.equal(scheduleCard(scheduleCard(card, 'good', 0), 'good', 0).interval, 10)
})

test('toeic stats predict a score and find weak skills', async () => {
  const { newAdult, withAnswers, predictScore, weakSkills, practiceSkills } = await import('../src/lib/adult.js')
  let adult = newAdult()
  assert.equal(predictScore(adult), null)
  adult = withAnswers(adult, [
    { part: 'p2', skill: 'why', correct: false }, { part: 'p2', skill: 'why', correct: false },
    { part: 'p2', skill: 'when', correct: true }, { part: 'p3', skill: 'mainIdea', correct: true },
    { part: 'p3', skill: 'nextAction', correct: false }, { part: 'p5', skill: 'tense', correct: true },
    { part: 'p5', skill: 'partOfSpeech', correct: true }, { part: 'vocab', skill: 'business', correct: false },
    { part: 'vocab', skill: 'business', correct: true }
  ])
  const score = predictScore(adult)
  assert.ok(score >= 10 && score <= 990 && score % 5 === 0)
  assert.equal(weakSkills(adult)[0].skill, 'why')
  assert.equal(practiceSkills(adult).length, 4)
})

test('shadowing marks words the learner said', async () => {
  const { compareShadow } = await import('../src/lib/adult.js')
  const result = compareShadow('They pushed back the release to next month.', 'they push back the release to next')
  assert.equal(result.score, 75)
  assert.deepEqual(result.missed, ['pushed', 'month'])
})

test('today plan adapts to due cards and diagnosis', async () => {
  const { newAdult, withCards, todayPlan } = await import('../src/lib/adult.js')
  const fresh = newAdult()
  assert.deepEqual(todayPlan(fresh).map((step) => step.id), ['chat', 'diagnosis'])
  const withDue = withCards({ ...fresh, diagnosed: true }, [{ en: 'I\'m swamped.', ja: '手一杯' }], '', new Date(0))
  assert.deepEqual(todayPlan(withDue).map((step) => step.id), ['review', 'chat', 'toeic'])
  assert.deepEqual(todayPlan(withDue, { short: true }).map((step) => step.id), ['review', 'chat'])
})

test('quiz keeps valid made questions and fills the rest from the bank', async () => {
  const { fillQuestions, parseChoice, validQuestion } = await import('../src/lib/quiz.js')
  const made = [
    { part: 'p2', skill: 'why', audio_en: 'Why?', question_en: '', choices: ['a', 'b', 'c'], answer: 1, explain_ja: '' },
    { part: 'p2', skill: 'when', audio_en: '', question_en: '', choices: ['a'], answer: 3, explain_ja: '' }
  ]
  assert.equal(validQuestion(made[1]), false)
  const items = fillQuestions(['who', 'tense', 'business'], made)
  assert.equal(items.length, 3)
  assert.equal(items[0].audio_en, 'Why?') // 同じパートの作った問題を先に使う
  assert.equal(items[1].skill, 'tense')
  assert.equal(parseChoice('ビー', ['x', 'y', 'z']), 1)
  assert.equal(parseChoice('Because the client asked', ['Yesterday.', 'Because the client asked.', 'Yes.']), 1)
  assert.equal(parseChoice('hmm', ['Yesterday.', 'Because.', 'Yes.']), -1)
})

test('review "hard" keeps growing and old saved adults get new fields', async () => {
  const { scheduleCard, loadAdultStore, ADULT_KEY } = await import('../src/lib/adult.js')
  let card = { interval: 0, reps: 0, lapses: 0, due: 0 }
  const seen = []
  for (let i = 0; i < 4; i += 1) { card = scheduleCard(card, 'hard', 0); seen.push(card.interval) }
  assert.deepEqual(seen, [1, 2, 3, 4])
  const storage = { getItem: (key) => (key === ADULT_KEY ? JSON.stringify({ current: 'a1', order: ['a1', 'gone'], adults: { a1: { id: 'a1', name: 'パパ' } } }) : null) }
  const store = loadAdultStore(storage)
  assert.deepEqual(store.order, ['a1'])
  assert.ok(Array.isArray(store.adults.a1.cards) && Array.isArray(store.adults.a1.shadows))
  assert.equal(store.adults.a1.name, 'パパ')
})

test('made questions whose skill does not match the part are rejected', async () => {
  const { validQuestion } = await import('../src/lib/quiz.js')
  const base = { part: 'p5', skill: 'tense', audio_en: '', question_en: 'He ------- here.', choices: ['is', 'are', 'be'], answer: 0, explain_ja: '' }
  assert.equal(validQuestion(base), true)
  assert.equal(validQuestion({ ...base, skill: 'why' }), false)
  assert.equal(validQuestion({ ...base, choices: ['is', ' ', 'be'] }), false)
})

test('train episodes: silence is trimmed and lines get timings with gaps', async () => {
  const { assemble, trimSilence, RATE } = await import('../src/lib/episodes.js')
  const voiced = (seconds) => { const a = new Float32Array(Math.round(seconds * RATE)); a.fill(0.2); return a }
  const padded = new Float32Array(RATE); padded.set(voiced(0.5), RATE * 0.25)
  const trimmed = trimSilence(padded)
  assert.ok(trimmed.length > RATE * 0.5 && trimmed.length < RATE * 0.6)
  const lines = [
    { speaker: 'Sam', en: 'Hi' }, { speaker: 'Alex', en: 'Hey' }, { speaker: 'Alex', en: 'skipped' }, { speaker: 'Alex', en: 'Again', pauseBefore: 3 }
  ]
  const { lines: kept, duration } = assemble(lines, [voiced(1), voiced(1), null, voiced(1)])
  assert.equal(kept.length, 3)
  assert.equal(kept[0].start, 0.3)
  assert.equal(kept[1].start, 1.3 + 0.45) // 話す人が変わったら 0.45 秒
  assert.ok(Math.abs(kept[2].start - (kept[1].end + 3)) < 1e-6) // 決めた間
  assert.ok(Math.abs(duration - (kept[2].end + 0.6)) < 1e-6)
})

test('train scripts: listening sets are validated and cards play ja then en twice', async () => {
  const { listeningScript, cardsScript } = await import('../src/lib/episodes.js')
  const { newAdult, withCards } = await import('../src/lib/adult.js')
  const good = { part: 'p3', lines: [{ speaker: 'M', en: 'a', ja: 'あ' }, { speaker: 'W', en: 'b', ja: 'い' }], question_en: 'Q?', choices: ['1', '2', '3', '4'], answer: 2, explain_ja: '' }
  const script = listeningScript({ sets: [good, { ...good, choices: ['1', '2'] }, { ...good, part: 'p4' }] })
  assert.equal(script.sets.length, 2)
  assert.deepEqual(script.lines.filter((line) => line.question).map((line) => line.set), [0, 1])
  const adult = withCards(newAdult(), [{ en: 'push back', ja: '延期する' }], '', new Date(0))
  const cards = cardsScript(adult)
  assert.deepEqual(cards.lines.map((line) => line.speaker), ['JA', 'Alex', 'Alex'])
  assert.equal(cards.lines[1].pauseBefore, 3)
  assert.throws(() => cardsScript(newAdult()), /no cards/)
})

test('letter of the day moves on only after a day it was played', async () => {
  const { letterToday, withLetterPlayed } = await import('../src/lib/state.js')
  let state = initialState()
  const d1 = new Date(2026, 9, 20, 9)
  const d2 = new Date(2026, 9, 21, 9)
  const d3 = new Date(2026, 9, 22, 9)
  assert.equal(letterToday(state, d1).item.letter, 'S')
  assert.equal(letterToday(state, d2).item.letter, 'S') // 聞かなかったら同じ文字
  state = withLetterPlayed(state, d1)
  assert.equal(state.lettersSeen.S, 1)
  state = withLetterPlayed(state, d1) // 同じ日に何回聞いても1回
  assert.equal(state.lettersSeen.S, 1)
  assert.equal(letterToday(state, d2).item.letter, 'A')
  assert.equal(letterToday(state, d3).item.letter, 'A')
})
