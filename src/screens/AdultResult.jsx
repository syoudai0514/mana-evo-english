// 終わったら「きょうのまとめ」：時間・話した文・TOEIC の結果・覚えたい言い方・Alex が覚えたこと
import React from 'react'
import { ADULT_PARTNERS, MEMORY_CATEGORIES } from '../data/adult.js'
import { parseMemory, predictScore, weakSkills, withoutMemory } from '../lib/adult.js'

export default function AdultResult({ adult, updateAdult, run, onHome }) {
  const results = run.results
  const partner = ADULT_PARTNERS[adult.partner] || ADULT_PARTNERS.alex
  const minutes = Math.max(1, Math.round((Date.now() - new Date(run.startedAt).getTime()) / 60000))
  const answers = results.answers || []
  const correct = answers.filter((item) => item.correct).length
  const shadow = results.shadowScores || []
  const score = predictScore(adult)
  const weak = weakSkills(adult)
  // この回に覚えたこと（消したものは出さない）
  const added = new Set((results.memoryAdded || []).map((raw) => parseMemory(raw).fact.toLowerCase()))
  const memory = adult.memory.filter((item) => added.has(item.fact.toLowerCase()))
  const learned = [...new Map((results.cardsAdded || []).map((card) => [card.en.toLowerCase(), card])).values()]
  const stats = [
    `${minutes}分`,
    results.sentences ? `英語で話した文 ${results.sentences}` : '',
    answers.length ? `TOEIC ${correct}/${answers.length} 正解` : '',
    results.reviewed ? `復習 ${results.reviewed}枚` : '',
    shadow.length ? `発音 平均 ${Math.round(shadow.reduce((a, b) => a + b, 0) / shadow.length)}点` : ''
  ].filter(Boolean)

  return (
    <div className="screen adult-dark">
      <div className="scroll">
        <div className="center" style={{ marginTop: 18 }}>
          <div className="en" style={{ font: '800 30px var(--en)', color: 'var(--mint)' }}>Great job!</div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{stats.join(' ・ ')}</div>
        </div>
        <div className="a-section">
          {learned.length > 0 && (
            <div className="a-card">
              <div className="t">📝 きょう覚えたい言い方</div>
              <div className="learned">{learned.slice(0, 6).map((card) => <div key={card.en}><b>{card.en}</b>（{card.ja}）</div>)}</div>
              <div className="muted s">→ 復習カードに入りました。次回の会話で {partner.name} もさりげなく使ってきます</div>
            </div>
          )}
          {memory.length > 0 && (
            <div className="a-card">
              <div className="t">🧠 {partner.name} が覚えたこと</div>
              {memory.map((item) => (
                <div key={item.id} className="mem">
                  <span>{MEMORY_CATEGORIES[item.cat]?.emoji}</span><span style={{ flex: 1 }}>{item.fact}</span>
                  <button className="x" onClick={() => updateAdult((current) => withoutMemory(current, item.id))}>けす</button>
                </div>
              ))}
            </div>
          )}
          {answers.length > 0 && (
            <div className="a-card">
              <div className="t">📈 TOEIC めやす</div>
              <div className="muted s" style={{ marginTop: 4 }}>
                {score ? <>予想スコア <span className="gold" style={{ fontWeight: 900 }}>{score}</span>（目標 {adult.target}）</> : 'もう少し問題をとくと予想スコアが出ます'}
                {weak.length ? <><br />苦手：{weak.map((row) => row.ja).join('／')}</> : null}
              </div>
            </div>
          )}
          {!stats.slice(1).length && <div className="muted center" style={{ fontWeight: 700 }}>おつかれさまでした！</div>}
          <button className="press cta" style={{ height: 56, fontSize: 18 }} onClick={onHome}>ホームへ</button>
        </div>
        <div style={{ height: 30 }} />
      </div>
    </div>
  )
}
