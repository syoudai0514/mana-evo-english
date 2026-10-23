import {
  TOEIC_SETS,
  TOEIC_QUESTIONS,
  toeicQuestion,
  TOEIC_PART_INFO
} from '../content/toeic.js'
import { learnerProgress, patchLearner } from './learning.js'
export function createExam({
  setId = null,
  part = 'all',
  count = 10,
  timed = false,
  now = Date.now()
} = {}) {
  const set = TOEIC_SETS.find((s) => s.id === setId)
  if (setId && !set) throw new Error('Unknown test set')
  if (timed && !set) throw new Error('Timed mode requires a complete set')
  const pool = set
    ? set.questionIds.map(toeicQuestion)
    : TOEIC_QUESTIONS.filter(
        (q) => q.purpose === 'practice' && (part === 'all' || q.part === part)
      )
  const selected = set ? pool : pool.slice(0, Math.max(1, Math.min(100, count)))
  const questions = selected.map((q) => q.id)
  return {
    id: `exam:${now}:${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`,
    version: 1,
    setId: set?.id || null,
    label:
      set?.label ||
      `${part === 'all' ? 'ミックス' : TOEIC_PART_INFO[part].label} ${questions.length}問`,
    timed,
    questionIds: questions,
    index: 0,
    answers: {},
    flags: [],
    hints: [],
    audioPlayed: [],
    startedAt: now,
    section: timed ? 'listening' : null,
    deadline: timed ? now + 45 * 60_000 : null,
    pausedAt: null,
    pauseTotalMs: 0,
    status: 'active',
    explanations: {},
    viewedAt: now
  }
}
export function updateExamAnswer(run, questionId, choice, now = Date.now()) {
  const q = toeicQuestion(questionId)
  if (
    run.status !== 'active' ||
    run.pausedAt ||
    !run.questionIds.includes(questionId) ||
    !q ||
    !Number.isInteger(choice) ||
    choice < 0 ||
    choice >= q.choices.length
  )
    return run
  if (!run.timed && run.explanations[questionId]) return run
  return {
    ...run,
    answers: {
      ...run.answers,
      [questionId]: {
        choice,
        questionVersion: q.version,
        elapsedMs: Math.max(0, now - (run.viewedAt || now)),
        answeredAt: now
      }
    }
  }
}
export function moveExam(run, index, now = Date.now()) {
  const q = toeicQuestion(run.questionIds[index])
  if (!q) return run
  if (run.timed && q.section !== run.section) return run
  return { ...run, index, viewedAt: now }
}
export function pauseExam(run, now = Date.now()) {
  if (!run.timed || run.status !== 'active' || run.pausedAt) return run
  return { ...run, pausedAt: now }
}
export function resumeExam(run, now = Date.now()) {
  if (!run.pausedAt) return run
  const duration = Math.max(0, now - run.pausedAt)
  return {
    ...run,
    pausedAt: null,
    deadline: run.deadline + duration,
    pauseTotalMs: run.pauseTotalMs + duration
  }
}
export function advanceSection(run, now = Date.now()) {
  if (!run.timed || run.section !== 'listening') return finishExam(run, now)
  return {
    ...run,
    section: 'reading',
    index: run.questionIds.findIndex(
      (id) => toeicQuestion(id).section === 'reading'
    ),
    deadline: now + 75 * 60_000,
    pausedAt: null,
    viewedAt: now
  }
}
export function tickExam(run, now = Date.now()) {
  if (
    !run.timed ||
    run.pausedAt ||
    run.status !== 'active' ||
    now < run.deadline
  )
    return run
  if (run.section === 'listening') {
    const next = advanceSection(run, run.deadline)
    return now >= next.deadline ? finishExam(next, now) : next
  }
  return finishExam(run, now)
}
export function finishExam(run, now = Date.now()) {
  return { ...run, status: 'complete', finishedAt: now, pausedAt: null }
}
export function examSummary(run) {
  const byPart = {}
  let answered = 0,
    correct = 0
  for (const id of run.questionIds) {
    const q = toeicQuestion(id),
      entry = run.answers[id]
    byPart[q.part] ||= { total: 0, answered: 0, correct: 0 }
    byPart[q.part].total++
    if (entry) {
      answered++
      byPart[q.part].answered++
      if (entry.choice === q.answerIndex) {
        correct++
        byPart[q.part].correct++
      }
    }
  }
  return {
    total: run.questionIds.length,
    answered,
    correct,
    unanswered: run.questionIds.length - answered,
    rate: answered ? correct / answered : null,
    byPart,
    hints: run.hints.length,
    pauseTotalMs: run.pauseTotalMs
  }
}
export function saveExam(store, key, run) {
  return patchLearner(store, key, (p) => {
    const sessions = { ...(p.toeicSessions || {}), [run.id]: run }
    const entries = Object.entries(sessions)
      .sort(([, a], [, b]) => b.startedAt - a.startedAt)
      .slice(0, 20)
    return {
      ...p,
      toeicSessions: Object.fromEntries(entries),
      activeExamId:
        run.status === 'active'
          ? run.id
          : p.activeExamId === run.id
            ? null
            : p.activeExamId || null
    }
  })
}
export function activeExam(store, key) {
  const p = learnerProgress(store, key)
  return p.toeicSessions?.[p.activeExamId] || null
}
