import React, { useEffect, useRef, useState } from 'react'
import {
  TOEIC_SETS,
  TOEIC_PART_INFO,
  toeicQuestion,
  toeicStimulus
} from '../../content/toeic.js'
import {
  createExam,
  updateExamAnswer,
  moveExam,
  pauseExam,
  resumeExam,
  advanceSection,
  tickExam,
  finishExam,
  examSummary,
  saveExam,
  activeExam
} from '../../lib/toeicExam.js'
import { useLessonAudio } from '../../hooks/useLessonAudio.js'
import ToeicStimulus from '../../components/learning/ToeicStimulus.jsx'
import { Icon } from '../../components/experience.jsx'
function timeLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
export default function ToeicPractice({
  learning,
  learnerId,
  updateLearning,
  onBack,
  onComplete
}) {
  const [run, publishRun] = useState(null),
    [part, setPart] = useState('all'),
    [count, setCount] = useState(10),
    [now, setNow] = useState(Date.now()),
    [showList, setShowList] = useState(false),
    [confirmEnd, setConfirmEnd] = useState(false),
    [reviewing, setReviewing] = useState(false),
    [visibleText, setVisibleText] = useState({})
  const audio = useLessonAudio(),
    reported = useRef(new Set())
  const saved = activeExam(learning, learnerId)
  const recent = Object.values(
    learning.learners[learnerId]?.toeicSessions || {}
  )
    .filter((exam) => exam.status === 'complete')
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .slice(0, 5)
  const runRef = useRef(run)
  const setRun = (change) => {
    const next = typeof change === 'function' ? change(runRef.current) : change
    if (next === runRef.current) return true
    if (
      next &&
      updateLearning((prev) => saveExam(prev, learnerId, next)) === false
    )
      return false
    runRef.current = next
    publishRun(next)
    return true
  }
  useEffect(() => {
    if (!run?.timed || run.status !== 'active') return
    const t = setInterval(() => {
      const stamp = Date.now()
      setNow(stamp)
      setRun((prev) => tickExam(prev, stamp))
    }, 1000)
    return () => clearInterval(t)
  }, [run?.id, run?.timed, run?.status])
  useEffect(() => {
    if (run?.status === 'complete' && !reported.current.has(run.id)) {
      reported.current.add(run.id)
      onComplete?.(run, examSummary(run))
    }
  }, [run?.status, run?.id])
  const start = (options) => {
    audio.stop()
    setRun(createExam(options))
    setConfirmEnd(false)
    setReviewing(false)
  }
  const exit = () => {
    audio.stop()
    onBack()
  }
  if (!run)
    return (
      <div className="screen adult-dark toeic-library">
        <div className="top">
          <button
            className="icon-btn"
            onClick={onBack}
            aria-label="TOEICの記録へ戻る"
          >
            ‹
          </button>
          <h1 className="title-lg">全7パートを練習</h1>
          <span>📘</span>
        </div>
        <div className="scroll lesson-scroll">
          <div className="library-intro">
            <span className="eyebrow">PRACTICE, UNDERSTAND, REPEAT</span>
            <h2>根拠を見つける練習を。</h2>
            <p>
              オリジナル600問。写真、応答、会話、説明文、文法、長文穴埋め、複数文書に対応しています。
            </p>
          </div>
          {saved && (
            <button
              className="resume-lesson"
              onClick={() => {
                setRun(tickExam(saved))
                setReviewing(false)
              }}
            >
              <Icon name="clock" />
              <span>
                {saved.label} のつづき（{Object.keys(saved.answers).length}/
                {saved.questionIds.length}回答）
              </span>
              <Icon name="arrow" />
            </button>
          )}
          <section className="lesson-panel">
            <h2>パート別に短く練習</h2>
            <div className="library-filters">
              <label>
                <span>パート</span>
                <select
                  aria-label="パート"
                  value={part}
                  onChange={(e) => setPart(e.target.value)}
                >
                  <option value="all">Part 1から順に</option>
                  {Object.entries(TOEIC_PART_INFO).map(([id, info]) => (
                    <option key={id} value={id}>
                      {info.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>問題数</span>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                >
                  {[5, 10, 20, 30].map((n) => (
                    <option key={n} value={n}>
                      {n}問まで
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="primary-action"
              onClick={() => start({ part, count })}
            >
              このパートを練習する
              <Icon name="arrow" />
            </button>
            <p className="content-note">
              練習では解答ごとに解説を確認できます。文字ヒントの使用も記録します。共有素材の一部の設問だけを練習する場合があります。
            </p>
          </section>
          {recent.length > 0 && (
            <section className="lesson-panel">
              <h2>保存した結果・解説</h2>
              {recent.map((exam) => {
                const result = examSummary(exam)
                return (
                  <div key={exam.id} className="test-set-card">
                    <div>
                      <strong>{exam.label}</strong>
                      <small>
                        {new Date(exam.finishedAt).toLocaleDateString('ja-JP')}{' '}
                        · {result.correct}/{result.total}正解 · 未回答
                        {result.unanswered}問
                      </small>
                    </div>
                    <button
                      className="lesson-secondary"
                      onClick={() => {
                        reported.current.add(exam.id)
                        setRun(exam)
                        setReviewing(false)
                      }}
                    >
                      結果と解説を開く
                    </button>
                  </div>
                )
              })}
            </section>
          )}
          <section className="lesson-panel">
            <h2>200問のセットで練習</h2>
            {TOEIC_SETS.map((set) => (
              <div key={set.id} className="test-set-card">
                <div>
                  <strong>{set.label}</strong>
                  <small>Listening 100問 / Reading 100問</small>
                </div>
                <button
                  className="lesson-secondary"
                  onClick={() =>
                    start({ setId: set.id, timed: set.purpose === 'mock' })
                  }
                >
                  {set.purpose === 'mock'
                    ? '計時してはじめる'
                    : '解説を見ながら解く'}
                </button>
              </div>
            ))}
            <p className="content-note">
              模試はListening 45分＋Reading
              75分の学習用タイマーです。通常練習には模試用の問題を出しません。中断ボタンで時計を止めた場合は結果に記録します。音声は端末の読み上げで、公式試験の録音・進行とは異なります。
            </p>
          </section>
          <p className="content-note">
            新作問題は言語・音声レビューを継続中です。公式教材ではなく、得点換算や本番の予測スコアは表示しません。
          </p>
        </div>
      </div>
    )
  const summary = examSummary(run)
  const q = toeicQuestion(run.questionIds[run.index]),
    source = toeicStimulus(q.stimulusId)
  const entry = run.answers[q.id],
    revealed =
      run.status === 'complete' || (!run.timed && run.explanations[q.id]),
    showText = Boolean(visibleText[q.id]) || revealed
  const patch = (fn) =>
    setRun((prev) => (typeof fn === 'function' ? fn(prev) : { ...prev, ...fn }))
  const navigate = (index) => {
    audio.stop()
    setRun((prev) =>
      run.status === 'complete' ? { ...prev, index } : moveExam(prev, index)
    )
    setShowList(false)
  }
  const choose = (choice) => {
    if (revealed) return
    setRun((prev) => updateExamAnswer(prev, q.id, choice))
  }
  const reveal = () => {
    audio.stop()
    patch((prev) => ({
      ...prev,
      explanations: { ...prev.explanations, [q.id]: true }
    }))
  }
  const toggleText = () => {
    setVisibleText((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
    patch((prev) => ({
      ...prev,
      hints: prev.hints.includes(q.id) ? prev.hints : [...prev.hints, q.id]
    }))
  }
  const inSection = (index) =>
    index >= 0 &&
    index < run.questionIds.length &&
    (!run.timed ||
      run.status === 'complete' ||
      toeicQuestion(run.questionIds[index]).section === run.section)
  const lastInSection =
    !inSection(run.index + 1) || run.index === run.questionIds.length - 1
  if (run.status === 'complete' && !reviewing)
    return (
      <div className="screen adult-dark">
        <div className="top">
          <button className="icon-btn" aria-label="TOEICへ戻る" onClick={exit}>
            ‹
          </button>
          <h1 className="title-lg">今回の練習記録</h1>
        </div>
        <div className="scroll lesson-scroll">
          <div className="lesson-finish">
            <span className="finish-art">🌿</span>
            <h2>
              {summary.correct} / {summary.total} 正解
            </h2>
            <p>
              回答 {summary.answered}問 · 未回答 {summary.unanswered}問 ·
              文字ヒント {summary.hints}問
            </p>
            {summary.pauseTotalMs > 0 && (
              <p>
                時計を止めた時間：{timeLeft(summary.pauseTotalMs)}
                （練習としての記録）
              </p>
            )}
            <div className="exam-part-summary">
              {Object.entries(summary.byPart).map(([id, value]) => (
                <div key={id}>
                  <span>{TOEIC_PART_INFO[id].label}</span>
                  <strong>
                    {value.correct}/{value.total}
                  </strong>
                </div>
              ))}
            </div>
            <button
              className="primary-action"
              onClick={() => {
                setRun((prev) => ({ ...prev, index: 0 }))
                setReviewing(true)
              }}
            >
              根拠とすべての解説を確認
            </button>
            <button className="lesson-secondary" onClick={() => setRun(null)}>
              次の練習を選ぶ
            </button>
            <button className="help-button" onClick={exit}>
              TOEICの記録へ
            </button>
          </div>
        </div>
      </div>
    )
  return (
    <div className="screen adult-dark toeic-exam">
      <header className="top">
        <button
          className="icon-btn"
          onClick={exit}
          aria-label="保存してTOEICに戻る"
        >
          ‹
        </button>
        <button
          className="exam-position"
          onClick={() => setShowList((v) => !v)}
        >
          {TOEIC_PART_INFO[q.part].label} · {run.index + 1}/
          {run.questionIds.length} ▾
        </button>
        {run.timed && run.status === 'active' ? (
          <span className="exam-clock" aria-live="off">
            {run.section === 'listening' ? 'L' : 'R'}{' '}
            {timeLeft(run.deadline - (run.pausedAt || now))}
          </span>
        ) : (
          <span className="chip">{revealed ? '解説' : '練習'}</span>
        )}
      </header>
      <div className="scroll lesson-scroll">
        {run.timed && run.status === 'active' && (
          <button
            className="lesson-secondary exam-pause"
            onClick={() => {
              audio.stop()
              setRun((prev) =>
                prev.pausedAt ? resumeExam(prev) : pauseExam(prev)
              )
            }}
          >
            {run.pausedAt ? '時計を再開する' : '一時停止（結果に記録）'}
          </button>
        )}
        {run.pausedAt ? (
          <div className="lesson-panel lesson-empty">
            練習を一時停止しています。問題を見るには時計を再開してください。
          </div>
        ) : (
          <>
            {showList && (
              <nav className="exam-question-nav" aria-label="問題一覧">
                {run.questionIds.map((id, i) => (
                  <button
                    key={id}
                    disabled={!inSection(i)}
                    aria-current={run.index === i ? 'page' : undefined}
                    className={`${run.answers[id] ? 'answered' : ''} ${run.flags.includes(id) ? 'flagged' : ''}`}
                    onClick={() => navigate(i)}
                  >
                    {i + 1}
                    {run.flags.includes(id) ? ' ⚑' : ''}
                  </button>
                ))}
              </nav>
            )}
            <ToeicStimulus
              key={source.id}
              source={source}
              question={q}
              exam={run.timed && !revealed}
              showText={showText}
              onReveal={toggleText}
              audio={audio}
            />
            <section className="lesson-panel exam-question">
              <div className="section-heading">
                <span className="lesson-meta">問題 {run.index + 1}</span>
                <button
                  className="help-button"
                  aria-pressed={run.flags.includes(q.id)}
                  onClick={() =>
                    patch((prev) => ({
                      ...prev,
                      flags: prev.flags.includes(q.id)
                        ? prev.flags.filter((id) => id !== q.id)
                        : [...prev.flags, q.id]
                    }))
                  }
                >
                  {run.flags.includes(q.id)
                    ? '⚑ あとで確認する'
                    : 'あとで確認に印をつける'}
                </button>
              </div>
              <h2 className="en">{q.prompt}</h2>
              <div className="exam-options">
                {q.choices.map((choice, i) => (
                  <button
                    key={i}
                    disabled={Boolean(revealed)}
                    aria-pressed={entry?.choice === i}
                    className={`${entry?.choice === i ? 'selected' : ''} ${revealed && q.answerIndex === i ? 'correct' : ''}`}
                    onClick={() => choose(i)}
                  >
                    <b>{'ABCD'[i]}</b>
                    <span>
                      {['p1', 'p2'].includes(q.part) && !showText
                        ? '音声を聞いて選ぶ'
                        : choice}
                    </span>
                  </button>
                ))}
              </div>
              {!run.timed && !revealed && (
                <button
                  className="primary-action lesson-next"
                  disabled={!entry}
                  onClick={reveal}
                >
                  答えと根拠を確認
                </button>
              )}
              {revealed && (
                <div className="exam-explanation">
                  <h3>
                    {entry?.choice === q.answerIndex
                      ? '✓ 正解'
                      : 'お手本の根拠を確認しよう'}
                  </h3>
                  <p className="en">{q.evidence}</p>
                  <p>{q.explainJa}</p>
                  <ol type="A">
                    {q.choiceExplanations.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
            <div className="exam-navigation">
              <button
                className="lesson-secondary"
                disabled={run.index === 0 || !inSection(run.index - 1)}
                onClick={() => navigate(run.index - 1)}
              >
                前へ
              </button>
              {lastInSection && run.status === 'active' ? (
                <button
                  className="primary-action"
                  onClick={() => setConfirmEnd(true)}
                >
                  {run.timed && run.section === 'listening'
                    ? 'Readingへ進む'
                    : '回答を提出する'}
                </button>
              ) : (
                <button
                  className="primary-action"
                  disabled={run.index === run.questionIds.length - 1}
                  onClick={() => navigate(run.index + 1)}
                >
                  次へ・保留
                </button>
              )}
            </div>
            {confirmEnd && (
              <div
                className="lesson-panel"
                role="alertdialog"
                aria-label="提出の確認"
              >
                <p>
                  未回答を含め、ここまでの記録で
                  {run.timed && run.section === 'listening'
                    ? 'Listeningを終了してReadingへ進みます。'
                    : '練習を終了します。'}
                </p>
                <button
                  className="primary-action"
                  onClick={() => {
                    audio.stop()
                    setRun((prev) =>
                      prev.timed && prev.section === 'listening'
                        ? advanceSection(prev)
                        : finishExam(prev)
                    )
                    setConfirmEnd(false)
                  }}
                >
                  確定する
                </button>
                <button
                  className="help-button"
                  onClick={() => setConfirmEnd(false)}
                >
                  問題にもどる
                </button>
              </div>
            )}
            {run.status === 'complete' && (
              <button
                className="help-button"
                onClick={() => setReviewing(false)}
              >
                今回の結果にもどる
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
