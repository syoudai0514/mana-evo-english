// Alex が覚えていること（カテゴリごと、ひとつずつ消せる）と、復習カードの一覧
import React, { useState } from 'react'
import { ADULT_PARTNERS, MEMORY_CATEGORIES } from '../data/adult.js'
import { withoutCard, withoutMemory } from '../lib/adult.js'
import { AdultTop } from '../components/adultUi.jsx'

export default function AdultMemory({ adult, updateAdult, navigate }) {
  const [tab, setTab] = useState('memory')
  const partner = ADULT_PARTNERS[adult.partner] || ADULT_PARTNERS.alex
  const groups = Object.keys(MEMORY_CATEGORIES).map((cat) => [cat, adult.memory.filter((item) => item.cat === cat)]).filter(([, items]) => items.length)
  return (
    <div className="screen adult-dark">
      <AdultTop onBack={() => navigate('adultHome')} title="🧠 記憶とカード" />
      <div className="seg" style={{ margin: '12px 16px 0', alignSelf: 'stretch' }}>
        <button className={tab === 'memory' ? 'on' : ''} onClick={() => setTab('memory')}>{partner.name} の記憶 {adult.memory.length}</button>
        <button className={tab === 'cards' ? 'on' : ''} onClick={() => setTab('cards')}>復習カード {adult.cards.length}</button>
      </div>
      <div className="scroll">
        <div className="a-section">
          {tab === 'memory' && (groups.length ? groups.map(([cat, items]) => (
            <div key={cat} className="a-card">
              <div className="t">{MEMORY_CATEGORIES[cat].emoji} {MEMORY_CATEGORIES[cat].label}</div>
              {items.slice().reverse().map((item) => (
                <div key={item.id} className="mem">
                  <span style={{ flex: 1 }}>{item.fact}<br /><span className="muted" style={{ fontSize: 11 }}>{item.date}</span></span>
                  <button className="x" onClick={() => updateAdult((current) => withoutMemory(current, item.id))}>けす</button>
                </div>
              ))}
            </div>
          )) : <div className="muted center" style={{ marginTop: 40, fontWeight: 700 }}>まだ何も覚えていません。<br />雑談すると、仕事や家族の話を覚えて次の会話で聞いてくれます。</div>)}
          {tab === 'cards' && (adult.cards.length ? (
            <div className="a-card">
              {adult.cards.slice().reverse().map((card) => (
                <div key={card.id} className="mem">
                  <span style={{ flex: 1 }}><b>{card.en}</b><br /><span className="muted" style={{ fontSize: 12 }}>{card.ja}・{card.interval ? `${card.interval}日間隔` : '新しい'}</span></span>
                  <button className="x" onClick={() => updateAdult((current) => withoutCard(current, card.id))}>けす</button>
                </div>
              ))}
            </div>
          ) : <div className="muted center" style={{ marginTop: 40, fontWeight: 700 }}>まだカードはありません。<br />会話で出た使える言い方が自動でカードになります。</div>)}
          <div className="muted s" style={{ padding: '0 4px' }}>記憶はこの iPhone の中だけに保存され、子どもの画面には出ません。</div>
        </div>
      </div>
    </div>
  )
}
