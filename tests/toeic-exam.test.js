import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TOEIC_QUESTIONS,
  TOEIC_STIMULI,
  TOEIC_SETS,
  validateToeic,
  toeicQuestion
} from '../src/content/toeic.js'
import {
  createExam,
  updateExamAnswer,
  pauseExam,
  resumeExam,
  tickExam,
  moveExam,
  examSummary,
  finishExam
} from '../src/lib/toeicExam.js'
test('600 validated questions retain complete 7-part distributions and unique set ownership', () => {
  assert.equal(TOEIC_QUESTIONS.length, 600)
  assert.deepEqual(validateToeic(), [])
  assert.deepEqual(
    TOEIC_SETS.map((s) => s.questionIds.length),
    [200, 200, 200]
  )
  for (const set of TOEIC_SETS) {
    assert.equal(
      set.questionIds.filter((id) => toeicQuestion(id).section === 'listening')
        .length,
      100
    )
    assert.equal(
      set.questionIds.filter((id) => toeicQuestion(id).section === 'reading')
        .length,
      100
    )
  }
  assert.equal(TOEIC_STIMULI.filter((s) => s.type === 'photo').length, 18)
  assert.equal(
    TOEIC_STIMULI.filter((s) => s.type === 'doubleDocument').length,
    6
  )
  assert.equal(
    TOEIC_STIMULI.filter((s) => s.type === 'tripleDocument').length,
    9
  )
})
test('ordinary practice never leaks a held-out mock question', () => {
  for (const part of ['all', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']) {
    const run = createExam({ part, count: 100 })
    assert.ok(
      run.questionIds.every((id) => toeicQuestion(id).purpose === 'practice')
    )
  }
})
test('timed session uses wall-clock deadlines through background and reload', () => {
  let run = createExam({ setId: 'toeic.mock.1', timed: true, now: 1000 })
  run = tickExam(run, 1000 + 46 * 60000)
  assert.equal(run.section, 'reading')
  assert.equal(run.index, 100)
  run = tickExam(run, 1000 + 121 * 60000)
  assert.equal(run.status, 'complete')
  assert.equal(examSummary(run).unanswered, 200)
})
test('explicit pause extends deadline and records the stopped time', () => {
  let run = createExam({ setId: 'toeic.mock.2', timed: true, now: 1000 })
  run = pauseExam(run, 2000)
  assert.equal(tickExam(run, 9999999).section, 'listening')
  run = resumeExam(run, 12000)
  assert.equal(run.pauseTotalMs, 10000)
  assert.equal(run.deadline, 1000 + 45 * 60000 + 10000)
})
test('unanswered items remain unanswered and results count actual choices', () => {
  let run = createExam({ part: 'p5', count: 5, now: 1000 })
  const q = toeicQuestion(run.questionIds[0])
  run = updateExamAnswer(run, q.id, q.answerIndex, 2000)
  run = finishExam(run, 3000)
  assert.deepEqual(
    [
      examSummary(run).answered,
      examSummary(run).correct,
      examSummary(run).unanswered
    ],
    [1, 1, 4]
  )
  assert.equal(updateExamAnswer(run, q.id, 0), run)
})
test('timed navigation cannot cross sections before the section changes', () => {
  const run = createExam({ setId: 'toeic.mock.1', timed: true })
  assert.equal(moveExam(run, 100), run)
  assert.equal(moveExam(run, 5).index, 5)
})
