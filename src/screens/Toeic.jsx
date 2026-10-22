// TOEIC：予想スコア・パートごとの正答率・苦手トップ3。診断と苦手つぶしへ
import React from 'react'
import { TOEIC_PARTS } from '../data/adult.js'
import { lastWeekScore, partStats, predictScore, weakSkills } from '../lib/adult.js'
import { unlockSpeech } from '../lib/tts.js'
import { AdultTop } from '../components/adultUi.jsx'

export default function Toeic({ adult, navigate, onStart, onPractice }) {
  const score = predictScore(adult)
  const before = lastWeekScore(adult)
  const stats = partStats(adult)
  const weak = weakSkills(adult)
  const start = (kind) => { unlockSpeech(); onStart(kind) }

  return (
    <div className="screen adult-dark">
      <AdultTop onBack={() => navigate('adultHome')} title="📘 TOEIC" />
      <div className="scroll">
        <div className="center" style={{ marginTop: 16 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>練習結果の参考換算（未校正）</div>
          <div className="en big-score">{score ?? '---'}</div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
            {score
              ? <>目標 {adult.target} {'・本番スコアの予測ではありません'}{before ? ` ・ 先週より ${score - before >= 0 ? '+' : ''}${score - before}` : ''}</>
              : 'まずは基礎チェック（10問）からはじめましょう'}
          </div>
        </div>

        <div className="a-section">
          <button className="primary-action" onClick={onPractice}>全7パート・600問の練習と模試へ →</button>
          {!adult.diagnosed && <button className="press cta" style={{ height: 56, fontSize: 18 }} onClick={() => start('diagnosis')}>🩺 基礎チェックをはじめる（10問）</button>}
          {adult.diagnosed && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="press cta" style={{ height: 56, fontSize: 17, flex: 2 }} onClick={() => start('toeic')}>🎯 苦手つぶし 4問</button>
              <button className="press btn ghost dark-ghost" style={{ flex: 1 }} onClick={() => start('diagnosis')}>もう一度チェック</button>
            </div>
          )}

          <div className="a-card">
            <div className="t" style={{ marginBottom: 8 }}>パートごとの正答率</div>
            {Object.entries(TOEIC_PARTS).map(([part, info]) => {
              const rate = stats[part].rate
              const percent = rate === null ? 0 : Math.round(rate * 100)
              const color = rate === null ? 'transparent' : rate >= 0.7 ? 'var(--mint)' : rate >= 0.55 ? 'var(--sun)' : 'var(--coral)'
              return (
                <div key={part} className="bar-row">
                  <span className="l">{info.label}</span>
                  <div className="bar"><div style={{ width: `${percent}%`, background: color }} /></div>
                  <span className="v">{rate === null ? '-' : `${percent}%`}</span>
                </div>
              )
            })}
            <div className="muted s" style={{ marginTop: 6 }}>{adult.answers.length}問ぶんの記録から</div>
          </div>

          <div className="a-card">
            <div className="t">🎯 いまの苦手トップ3</div>
            {weak.length
              ? <ol className="weak">{weak.map((row) => <li key={row.skill}>{row.ja}<span className="muted">（{row.correct}/{row.total}）</span></li>)}</ol>
              : <div className="muted s" style={{ marginTop: 6 }}>問題をとくと、苦手な分野がわかります</div>}
            <div className="muted s" style={{ marginTop: 4 }}>→ 苦手つぶしと、Alex との雑談の話題に自動で入ります</div>
          </div>

          <button className="press a-card row" onClick={() => start('toeicTalk')}>
            <div className="e">🏢</div>
            <div style={{ flex: 1, textAlign: 'left' }}><div className="t">TOEIC の話題で雑談</div><div className="muted s">延期・見積もり・会議…ビジネス場面を会話で</div></div>
            <span className="chip">›</span>
          </button>
          <div className="muted s" style={{ padding: '0 4px', lineHeight: 1.6 }}>独自の練習問題です。基礎チェックは Part 2・3・5 と語彙を扱います。全7パートは「練習と模試」の教材から選べます。参考換算は少数の練習結果による未校正の値で、本番スコア・目標達成を示しません。</div>
        </div>
        <div style={{ height: 30 }} />
      </div>
    </div>
  )
}
