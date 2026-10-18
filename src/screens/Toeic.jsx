// TOEIC：予想スコア・パートごとの正答率・苦手トップ3。診断と苦手つぶしへ
import React from 'react'
import { TOEIC_PARTS } from '../data/adult.js'
import { lastWeekScore, partStats, predictScore, weakSkills } from '../lib/adult.js'
import { unlockSpeech } from '../lib/tts.js'
import { AdultTop } from '../components/adultUi.jsx'

export default function Toeic({ adult, navigate, onStart }) {
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
          <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>いまの予想スコア（めやす）</div>
          <div className="en big-score">{score ?? '---'}</div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
            {score
              ? <>目標 {adult.target} {score >= adult.target ? 'を達成！' : `まで あと ${adult.target - score}`}{before ? ` ・ 先週より ${score - before >= 0 ? '+' : ''}${score - before}` : ''}</>
              : 'まずは実力診断（10問）を受けてください'}
          </div>
        </div>

        <div className="a-section">
          {!adult.diagnosed && <button className="press cta" style={{ height: 56, fontSize: 18 }} onClick={() => start('diagnosis')}>🩺 実力診断をうける（10問）</button>}
          {adult.diagnosed && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="press cta" style={{ height: 56, fontSize: 17, flex: 2 }} onClick={() => start('toeic')}>🎯 苦手つぶし 4問</button>
              <button className="press btn ghost dark-ghost" style={{ flex: 1 }} onClick={() => start('diagnosis')}>もう一度診断</button>
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
          <div className="muted s" style={{ padding: '0 4px', lineHeight: 1.6 }}>※ 問題は公式と同じ形式で AI が作ったオリジナルです。予想スコアは正答率から出した目安です。</div>
        </div>
        <div style={{ height: 30 }} />
      </div>
    </div>
  )
}
