import React, { useState } from 'react'
import { lessonById } from '../../content/index.js'
import {
  AudioControls,
  PhraseList,
  ChoiceStep
} from '../../components/learning/LessonParts.jsx'
import { useLessonAudio } from '../../hooks/useLessonAudio.js'
import { useLessonSession } from '../../hooks/useLessonSession.js'
import {
  completeLesson,
  importedCards,
  reportContent
} from '../../lib/learning.js'
import { Icon } from '../../components/experience.jsx'
import { prepareCuratedEpisode } from '../../lib/curatedAudio.js'

export default function LessonPlayer(props) {
  const item = lessonById(props.lessonId)
  if (!item)
    return (
      <div className="screen">
        <button className="primary-action" onClick={props.onBack}>
          教材を選び直す
        </button>
      </div>
    )
  return (
    <LessonSession
      key={`${props.learnerId}:${item.id}`}
      {...props}
      item={item}
    />
  )
}
function LessonSession({
  item,
  adult,
  learning,
  learnerId,
  updateLearning,
  updateAdult,
  onBack,
  onCompleted,
  onTalk,
  showToast,
  onPlayEpisode
}) {
  const { draft, patch, restart } = useLessonSession({
    item,
    learning,
    learnerId,
    updateLearning
  })
  const audio = useLessonAudio({
    onEvent: (event) =>
      patch((prev) => ({
        audioEvents: [...(prev.audioEvents || []), event].slice(-200)
      }))
  })
  const [finished, setFinished] = useState(false),
    [reporting, setReporting] = useState(false),
    [report, setReport] = useState(''),
    [preparing, setPreparing] = useState(null)
  const kid = !adult
  const complete = () => {
    audio.stop()
    const result = {
      answers: draft.answers,
      notes: draft.notes,
      mode: draft.mode,
      path: draft.path,
      kind: item.kind,
      audioEvents: draft.audioEvents || []
    }
    if (
      updateLearning((prev) =>
        completeLesson(prev, learnerId, item, result)
      ) === false
    )
      return
    onCompleted?.(item, result)
    setFinished(true)
  }
  const addCards = () => {
    if (!adult) return
    const rows = (item.reviewPhrases || item.phrases).map((p, i) => ({
      ...p,
      id: p.id || `${item.id}.${i}`,
      sourceLessonId: item.id,
      categoryLabel: item.categoryLabel
    }))
    updateAdult((current) => importedCards(current, rows, { limit: 5 }))
    showToast('重複を除き、最大5枚を復習に追加しました')
  }
  const next = () => {
    audio.stop()
    patch((prev) => ({ index: prev.index + 1, help: false }))
  }
  const sendReport = () => {
    if (!report.trim()) return
    if (
      updateLearning((prev) =>
        reportContent(prev, learnerId, item.id, report)
      ) === false
    )
      return
    setReporting(false)
    setReport('')
    showToast('内容の報告をこの端末に保存しました。設定から書き出せます')
  }
  const progressTotal =
    item.kind === 'kids-activity'
      ? item.steps.length
      : item.kind === 'conversation'
        ? item.dialogue.length
        : item.kind === 'listening'
          ? item.checks.length
          : item.phrases.length
  const prepare = async () => {
    setPreparing({ done: 0, total: 0 })
    try {
      const ep = await prepareCuratedEpisode(item, adult, (stage) =>
        setPreparing(stage)
      )
      setPreparing(null)
      showToast(
        ep.mock
          ? '画面確認用の音を保存しました（英語音声ではありません）'
          : '音声を端末に保存しました'
      )
      onPlayEpisode?.(ep.id)
    } catch (error) {
      setPreparing(null)
      showToast(
        error.code === 'auth'
          ? 'AIのログインが必要です。設定でログインしてください'
          : '音声を保存できませんでした。通信と端末の空き容量を確認してください'
      )
    }
  }
  return (
    <div className={`screen lesson-player ${adult ? 'adult-dark' : ''}`}>
      <header className="top">
        <button
          className="icon-btn"
          aria-label="教材の本棚にもどる"
          onClick={() => {
            audio.stop()
            onBack()
          }}
        >
          ‹
        </button>
        <span className="lesson-top-title">{item.title.ja}</span>
        <button
          className="icon-btn"
          aria-label="内容の報告"
          onClick={() => setReporting((v) => !v)}
        >
          ⋯
        </button>
      </header>
      <div className="scroll lesson-scroll">
        {reporting && (
          <div className="lesson-panel">
            <label className="lesson-input-label">
              気になる表現・問題
              <textarea
                value={report}
                maxLength={500}
                onChange={(e) => setReport(e.target.value)}
              />
            </label>
            <button
              className="lesson-secondary"
              onClick={sendReport}
              disabled={!report.trim()}
            >
              この端末に報告を保存
            </button>
          </div>
        )}
        {finished ? (
          <div className="lesson-finish">
            <span className="finish-art">🌻</span>
            <span className="eyebrow">ONE MORE LITTLE STEP</span>
            <h1>{kid ? 'できたね！' : '今日の一歩ができました。'}</h1>
            <p>{item.title.ja}</p>
            <p>
              {kid
                ? 'すこしずつで、だいじょうぶ。また あそぼう！'
                : '覚えた表現を、自分の場面で一度使ってみましょう。'}
            </p>
            {adult && (
              <button className="lesson-secondary" onClick={addCards}>
                フレーズを復習に追加（最大5枚）
              </button>
            )}
            <button className="primary-action" onClick={onBack}>
              {kid ? 'つぎの ぼうけんを えらぶ' : '教材の本棚へ'}
            </button>
            <button
              className="help-button"
              onClick={() => {
                restart()
                setFinished(false)
              }}
            >
              もういちど
            </button>
          </div>
        ) : (
          <>
            <div className="lesson-hero">
              <span className="lesson-hero-emoji">
                {item.emoji ||
                  { phonics: '🔤', phrase: '💬', shadow: '🎤' }[item.kind] ||
                  '📖'}
              </span>
              <span className="eyebrow">
                {item.level} · {item.estimatedMinutes} MINUTES
              </span>
              <h1>{item.title.ja}</h1>
              <ul>
                {item.goals.map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </ul>
            </div>
            {item.kind === 'kids-activity' && (
              <>
                <div
                  className="lesson-mode"
                  role="group"
                  aria-label="あそびかた"
                >
                  {[
                    ['listen', 'きくだけ'],
                    ['guided', 'いっしょに'],
                    ['speak', 'じぶんで']
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      aria-pressed={draft.mode === id}
                      onClick={() => patch({ mode: id })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {draft.phase === 'learn' ? (
                  <>
                    <div className="lesson-panel">
                      <h2>きょうの ことば</h2>
                      <AudioControls audio={audio} lines={item.phrases} />
                      <PhraseList phrases={item.phrases} audio={audio} />
                    </div>
                    <button
                      className="primary-action lesson-next"
                      onClick={() => patch({ phase: 'practice', index: 0 })}
                    >
                      ぼうけんを はじめる
                      <Icon name="arrow" />
                    </button>
                  </>
                ) : draft.index < item.steps.length ? (
                  <div className="lesson-panel">
                    <div className="lesson-progress-label">
                      {draft.index + 1} / {item.steps.length}
                    </div>
                    {draft.mode === 'listen' ? (
                      <>
                        <h2>{item.steps[draft.index].ja}</h2>
                        <AudioControls
                          audio={audio}
                          lines={[item.steps[draft.index].prompt]}
                        />
                        <p>きいてみたら、つぎへ。よむだけでも だいじょうぶ。</p>
                        <button className="primary-action" onClick={next}>
                          つぎへ
                        </button>
                      </>
                    ) : (
                      <>
                        <ChoiceStep
                          step={item.steps[draft.index]}
                          seed={`${item.id}.${draft.index}`}
                          kid={kid}
                          chosen={draft.answers[draft.index] ?? null}
                          onChoose={(answer) =>
                            patch((prev) => ({
                              answers: { ...prev.answers, [prev.index]: answer }
                            }))
                          }
                          help={draft.help || draft.mode === 'guided'}
                          onHelp={() => {
                            patch({ help: true })
                            audio.play([item.steps[draft.index].prompt])
                          }}
                          audio={audio}
                        />
                        {draft.answers[draft.index] != null && (
                          <button
                            className="primary-action lesson-next"
                            onClick={next}
                          >
                            つぎへ
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <button
                    className="primary-action lesson-next"
                    onClick={complete}
                  >
                    できた！
                  </button>
                )}
              </>
            )}
            {item.kind === 'story' && (
              <div className="lesson-panel story-page">
                <span className="lesson-progress-label">
                  {Math.min(draft.path.length + 1, 4)} ページ
                </span>
                <h2>きみが えらぶ おはなし</h2>
                <p className="story-en en">{item.nodes[draft.node]?.line.en}</p>
                <p className="story-ja">{item.nodes[draft.node]?.line.ja}</p>
                <AudioControls
                  audio={audio}
                  lines={[item.nodes[draft.node]?.line]}
                />
                {item.nodes[draft.node]?.end ? (
                  <button
                    className="primary-action lesson-next"
                    onClick={complete}
                  >
                    おはなし できあがり！
                  </button>
                ) : (
                  <div className="story-choices">
                    {item.nodes[draft.node]?.choices.map((choice) => (
                      <button
                        key={choice.next}
                        onClick={() => {
                          audio.stop()
                          patch((prev) => ({
                            node: choice.next,
                            path: [...prev.path, prev.node]
                          }))
                        }}
                      >
                        <strong>{choice.en}</strong>
                        <span>{choice.ja}</span>
                        <Icon name="arrow" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {item.kind === 'world-friend' && (
              <div className="lesson-panel">
                <p className="fictional-note">{item.about}</p>
                <h2>
                  {item.nameJa} · {item.countryJa}
                </h2>
                <PhraseList phrases={item.phrases} audio={audio} />
                <label className="lesson-input-label">
                  きみは なにをするのが すき？（かかなくても いいよ）
                  <input
                    value={draft.notes.reply || ''}
                    maxLength={120}
                    onChange={(e) =>
                      patch((prev) => ({
                        notes: { ...prev.notes, reply: e.target.value }
                      }))
                    }
                  />
                </label>
                <button
                  className="primary-action lesson-next"
                  onClick={complete}
                >
                  また あそぼうね！
                </button>
              </div>
            )}
            {item.kind === 'phonics' && (
              <div className="lesson-panel">
                {item.letter ? (
                  <>
                    <div className="phonics-letter en">
                      {item.letter}
                      <span>{item.letter.toLowerCase()}</span>
                    </div>
                    <h2>なまえと おとは、べつなんだね</h2>
                    <div className="phonics-actions">
                      <button onClick={() => audio.play([item.letter])}>
                        もじの なまえを きく<small>{item.letterName}</small>
                      </button>
                      <button onClick={() => audio.play([item.word])}>
                        ことばの おてほん
                        <small>
                          {item.emoji} {item.word}
                        </small>
                      </button>
                    </div>
                    <p>{item.mouth}</p>
                    <p className="content-note">
                      おとの めやす /{item.phoneme}/。ことばの中で
                      きいてみよう。カタカナは正しい発音そのものではありません。
                    </p>
                  </>
                ) : item.mode === 'cvc' ? (
                  <>
                    <div className="phonics-letter">{item.emoji}</div>
                    <h2 className="en cvc-word">
                      {item.segments.map((part, i) => (
                        <span key={i} className={i === 1 ? 'vowel' : ''}>
                          {part}
                        </span>
                      ))}
                    </h2>
                    <p>{item.ja}</p>
                    <AudioControls audio={audio} lines={[item.word]} />
                    <p>
                      お手本を きいて、3つの おとを つなげてみよう。文字の名前を
                      つなげるのとは ちがうよ。
                    </p>
                  </>
                ) : (
                  <>
                    <h2>ききくらべよう</h2>
                    <p>ちがいの めやす /{item.contrast}/</p>
                    <PhraseList phrases={item.phrases} audio={audio} />
                    <h3>きこえたのは どっち？</h3>
                    <button
                      className="lesson-secondary"
                      onClick={() =>
                        audio.play([
                          item.phrases[Number(item.id.split('.').at(-1)) % 2]
                        ])
                      }
                    >
                      おとだけ きく
                    </button>
                    <ChoiceStep
                      step={{
                        question: 'きこえた ことばを えらぼう',
                        choices: item.phrases,
                        answer: Number(item.id.split('.').at(-1)) % 2
                      }}
                      seed={item.id}
                      chosen={draft.answers.pair ?? null}
                      onChoose={(answer) =>
                        patch((prev) => ({
                          answers: { ...prev.answers, pair: answer }
                        }))
                      }
                      help={draft.help}
                      onHelp={() => patch({ help: true })}
                      kid
                      audio={audio}
                    />
                    <p>はじめは ちがいが わからなくても だいじょうぶ。</p>
                  </>
                )}
                <button
                  className="primary-action lesson-next"
                  onClick={complete}
                >
                  きょうの おとを れんしゅうした
                </button>
              </div>
            )}
            {item.kind === 'conversation' && (
              <div className="lesson-panel">
                {draft.phase === 'learn' ? (
                  <>
                    <h2>場面で使う3つの表現</h2>
                    <PhraseList phrases={item.phrases} audio={audio} />
                    <button
                      className="primary-action lesson-next"
                      onClick={() => patch({ phase: 'dialogue', index: 0 })}
                    >
                      会話の役をやってみる
                    </button>
                    {onTalk && (
                      <button
                        className="lesson-secondary lesson-next"
                        onClick={() => onTalk(item)}
                      >
                        この場面でAIと自由に話す
                      </button>
                    )}
                  </>
                ) : draft.index < item.dialogue.length ? (
                  <>
                    <div className="lesson-progress-label">
                      {draft.index + 1} / {item.dialogue.length} ·{' '}
                      {item.dialogue[draft.index].speaker === 'learner'
                        ? 'あなたの番'
                        : '相手の番'}
                    </div>
                    <p className="dialogue-line en">
                      {item.dialogue[draft.index].en}
                    </p>
                    <p>{item.dialogue[draft.index].ja}</p>
                    <AudioControls
                      audio={audio}
                      lines={[item.dialogue[draft.index]]}
                    />
                    <button
                      className="primary-action lesson-next"
                      onClick={next}
                    >
                      {item.dialogue[draft.index].speaker === 'learner'
                        ? '声に出して練習した・つぎへ'
                        : 'つぎの応答へ'}
                    </button>
                  </>
                ) : (
                  <>
                    <h2>自分のことばにしてみよう</h2>
                    {item.questions.map((q, i) => (
                      <label key={q.en} className="lesson-input-label">
                        <span className="en">{q.en}</span>
                        <small>{q.ja}</small>
                        <textarea
                          value={draft.notes[i] || ''}
                          maxLength={500}
                          onChange={(e) =>
                            patch((prev) => ({
                              notes: { ...prev.notes, [i]: e.target.value }
                            }))
                          }
                        />
                      </label>
                    ))}
                    <button className="primary-action" onClick={complete}>
                      練習を記録する
                    </button>
                  </>
                )}
              </div>
            )}
            {item.kind === 'listening' && (
              <>
                <div className="lesson-panel">
                  <h2>まずは会話を聞く</h2>
                  <AudioControls audio={audio} lines={item.script} />
                  {item.script.map((row, i) => (
                    <button
                      key={i}
                      className={`transcript-line ${audio.active === i ? 'speaking' : ''}`}
                      onClick={() => audio.play([row])}
                    >
                      <b>{row.speaker}</b>
                      <span>
                        <strong className="en">{row.en}</strong>
                        <small>{row.ja}</small>
                      </span>
                    </button>
                  ))}
                  <h3>5つの表現を、間をあけて復唱</h3>
                  <PhraseList phrases={item.phrases} audio={audio} />
                  {adult && (
                    <button
                      className="lesson-secondary lesson-next"
                      disabled={Boolean(preparing)}
                      onClick={prepare}
                    >
                      {preparing
                        ? `保存用音声を準備中 ${preparing.done || 0}/${preparing.total || '…'}`
                        : '音声を作って端末に保存（AIログインが必要）'}
                    </button>
                  )}
                  <p className="content-note">
                    端末の読み上げは字幕をタップして聞けます。保存用音声を準備すると、取得済みの番組を電車モードで再生できます。
                  </p>
                </div>
                <div className="lesson-panel">
                  <h2>意味を3問で確認</h2>
                  {draft.index < item.checks.length ? (
                    <>
                      <ChoiceStep
                        step={item.checks[draft.index]}
                        seed={`${item.id}.${draft.index}`}
                        chosen={draft.answers[draft.index] ?? null}
                        onChoose={(answer) =>
                          patch((prev) => ({
                            answers: { ...prev.answers, [prev.index]: answer }
                          }))
                        }
                        help={draft.help}
                        onHelp={() => patch({ help: true })}
                        audio={audio}
                      />
                      {draft.answers[draft.index] != null && (
                        <button
                          className="primary-action lesson-next"
                          onClick={next}
                        >
                          つぎへ
                        </button>
                      )}
                    </>
                  ) : (
                    <button className="primary-action" onClick={complete}>
                      聞く練習を記録
                    </button>
                  )}
                </div>
              </>
            )}
            {(item.kind === 'phrase' || item.kind === 'shadow') && (
              <div className="lesson-panel">
                <h2>
                  {item.kind === 'shadow'
                    ? 'まとまりで聞いて、声に出す'
                    : 'この場面のひとこと'}
                </h2>
                <PhraseList phrases={item.phrases} audio={audio} />
                {item.kind === 'shadow' ? (
                  <>
                    <p className="shadow-chunks en">
                      {item.chunks.join(' / ')}
                    </p>
                    <p>{item.stressNote}</p>
                    <p>{item.linkingNote}</p>
                    <AudioControls audio={audio} lines={item.phrases} />
                    <label className="lesson-input-label">
                      覚えておきたいこと
                      <textarea
                        value={draft.notes.memo || ''}
                        maxLength={300}
                        onChange={(e) =>
                          patch({ notes: { memo: e.target.value } })
                        }
                      />
                    </label>
                    <p className="content-note">
                      声に出す練習です。発音を自動採点する機能はありません。
                    </p>
                  </>
                ) : (
                  <>
                    <p>{item.usage}で使う表現です。</p>
                    <p>{item.translationNote}</p>
                    <h3>聞き返したいとき</h3>
                    <PhraseList phrases={[item.alternative]} audio={audio} />
                  </>
                )}
                {adult && (
                  <button
                    className="lesson-secondary lesson-next"
                    onClick={addCards}
                  >
                    この表現を復習カードへ
                  </button>
                )}
                <button
                  className="primary-action lesson-next"
                  onClick={complete}
                >
                  練習を記録
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
