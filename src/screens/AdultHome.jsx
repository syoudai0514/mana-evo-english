// 大人のホーム：Alex が前回の話の続きから話しかけてくる。きょうのメニューとコース
import React, { useMemo, useState } from 'react'
import { ADULT_COURSES, ADULT_PARTNERS, MEMORY_CATEGORIES } from '../data/adult.js'
import { adultStreak, dueCards, greetingFor, predictScore, todayPlan, withoutAdult } from '../lib/adult.js'
import { unlockSpeech } from '../lib/tts.js'
import { readAloud } from '../lib/reader.js'

const STEP_INFO = {
  review: { emoji: '🔁', title: (step) => `言い方の復習 ${step.count}枚`, about: () => '忘れかけた順に出します' },
  shadow: { emoji: '🎧', title: (step) => `シャドーイング ${step.count}文`, about: () => '最近の会話の文を、まねして発音' },
  chat: { emoji: '☕', title: () => 'Alex と雑談', about: (step, greeting) => (greeting.fact ? `「${greeting.fact.fact}」の続きから` : 'まずは自己紹介から') },
  toeic: { emoji: '📘', title: (step) => `TOEIC 苦手つぶし ${step.count}問`, about: () => '苦手な分野から出題' },
  diagnosis: { emoji: '🩺', title: () => 'TOEIC 実力診断 10問', about: () => '最初に一度だけ。苦手と予想スコアがわかります' }
}

export default function AdultHome({ adult, adultStore, updateAdult, updateAdultStore, navigate, showToast, onStart, onSwitch }) {
  const [short, setShort] = useState(false)
  const [settings, setSettings] = useState(false)
  const partner = ADULT_PARTNERS[adult.partner] || ADULT_PARTNERS.alex
  const greeting = useMemo(() => greetingFor(adult), [adult.memory[adult.memory.length - 1]?.id])
  const plan = todayPlan(adult, { short })
  const minutes = plan.reduce((sum, step) => sum + step.minutes, 0)
  const score = predictScore(adult)
  const streak = adultStreak(adult)
  const due = dueCards(adult, Date.now(), 999).length
  const counts = {}
  for (const item of adult.memory) counts[item.cat] = (counts[item.cat] || 0) + 1

  const start = (kind, steps) => { unlockSpeech(); onStart(kind, steps) }

  if (settings) return <AdultSettings adult={adult} adultStore={adultStore} updateAdult={updateAdult} updateAdultStore={updateAdultStore} showToast={showToast} onBack={() => setSettings(false)} onSwitch={onSwitch} />

  return (
    <div className="screen adult-dark">
      <div className="top">
        <button className="pill" onClick={onSwitch}><span className="ic">{adult.emoji}</span>{adult.name} <span className="muted" style={{ fontSize: 11 }}>きりかえ</span></button>
        <div style={{ display: 'flex', gap: 8 }}>
          {streak > 0 && <div className="pill"><span className="ic">🔥</span>{streak}日</div>}
          <button className="icon-btn" aria-label="設定" onClick={() => setSettings(true)}>⚙️</button>
        </div>
      </div>
      <div className="scroll">
        <div className="a-greet">
          <div className="avatar big">{partner.emoji}</div>
          <button className="a-bubble" onClick={() => { unlockSpeech(); readAloud(greeting.en) }}>
            {greeting.en}
            <div className="a-ja">{greeting.ja}</div>
          </button>
        </div>
        <div className="muted a-who">{partner.name}（{partner.about}）・タップで読み上げ</div>

        <div className="a-section">
          <div className="a-head">
            <div><div className="en" style={{ font: '800 24px var(--en)' }}>Today's plan</div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>{minutes}分ぶん{score ? ` ・ 予想スコア ` : ''}{score ? <span className="gold">{score}</span> : ''}{score ? `（目標 ${adult.target}）` : ''}</div></div>
            <div className="seg">
              <button className={!short ? 'on' : ''} onClick={() => setShort(false)}>15分</button>
              <button className={short ? 'on' : ''} onClick={() => setShort(true)}>5分だけ</button>
            </div>
          </div>
          {plan.map((step) => {
            const info = STEP_INFO[step.id]
            return (
              <div key={step.id} className={`a-card row ${step.id === 'chat' ? 'hl' : ''}`}>
                <div className="e">{info.emoji}</div>
                <div style={{ flex: 1 }}><div className="t">{info.title(step)}</div><div className="muted s">{info.about(step, greeting)}</div></div>
                <span className="chip">{step.minutes}分</span>
              </div>
            )
          })}
          <button className="press cta" style={{ height: 56, fontSize: 18, marginTop: 4 }} onClick={() => start('plan', plan.map((step) => (step.id === 'chat' ? { id: 'chat', course: 'chat', minutes: step.minutes } : step)))}>はじめる ▶</button>
        </div>

        <div className="a-section">
          <div className="a-label">コースを選ぶ</div>
          <button className="press a-card big-course train-course" onClick={() => navigate('train')}>
            <div className="t">🚃 電車モード（聞くだけ）</div>
            <div className="s">話さなくてOK。ネイティブの雑談・あなたの会話のネイティブ版・TOEIC リスニング・耳で復習</div>
          </button>
          <button className="press a-card big-course" onClick={() => start('chatStudy')}>
            <div className="t">☕→📘 雑談して、最後にお勉強</div>
            <div className="s">雑談 {ADULT_COURSES.chatStudy.chatMinutes}分 → きょうの言い直し＋TOEIC ミニ問題</div>
          </button>
          <div className="a-grid">
            <CourseCard emoji="☕" title="雑談だけ" about="仕事・家族・グチもOK" onClick={() => start('chat')} />
            <CourseCard emoji="📘" title="TOEIC" about={score ? `予想 ${score}` : '診断・苦手つぶし'} onClick={() => navigate('toeicStats')} />
            <CourseCard emoji="💼" title="仕事の英語" about="会議・報告・依頼" onClick={() => start('work')} />
            <CourseCard emoji="🧒" title="子どもへの声かけ" about="おうち英語" onClick={() => start('kid')} />
            <CourseCard emoji="🔁" title="復習カード" about={`${adult.cards.length}枚${due ? `（いま ${due}枚）` : ''}`} onClick={() => (adult.cards.length ? start('review') : showToast('会話をすると言い方がカードになります'))} />
            <CourseCard emoji="🎧" title="シャドーイング" about="発音チェック" onClick={() => start('shadow')} />
            <CourseCard emoji="🧳" title="旅行" about="ホテル・レストラン" onClick={() => start('travel')} />
            <CourseCard emoji="🏢" title="TOEIC の話題で雑談" about="ビジネス場面" onClick={() => start('toeicTalk')} />
          </div>
        </div>

        <button className="a-card row a-mem" onClick={() => navigate('adultMemory')}>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div className="t">🧠 {partner.name} が覚えていること</div>
            <div className="muted s">{adult.memory.length ? Object.entries(counts).map(([cat, n]) => `${MEMORY_CATEGORIES[cat]?.label || cat} ${n}`).join('・') : 'まだありません。雑談すると覚えていきます'}</div>
          </div>
          <span className="chip">みる ›</span>
        </button>
        <div style={{ height: 30 }} />
      </div>
    </div>
  )
}

function CourseCard({ emoji, title, about, onClick }) {
  return (
    <button className="press a-card" onClick={onClick}>
      <div className="e">{emoji}</div>
      <div className="t">{title}</div>
      <div className="muted s">{about}</div>
    </button>
  )
}

function AdultSettings({ adult, adultStore, updateAdult, updateAdultStore, showToast, onBack, onSwitch }) {
  const [name, setName] = useState(adult.name)
  const [target, setTarget] = useState(String(adult.target))
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="screen adult-dark">
      <div className="top"><button className="icon-btn" onClick={onBack}>‹</button><div className="pill">⚙️ 設定</div><div style={{ width: 42 }} /></div>
      <div className="scroll">
        <div className="a-section">
          <div className="a-card">
            <div className="field"><label>よび名</label><input value={name} maxLength={10} onChange={(event) => setName(event.target.value)} /></div>
            <div className="field"><label>TOEIC の目標スコア</label><input inputMode="numeric" value={target} onChange={(event) => setTarget(event.target.value.replace(/\D/g, '').slice(0, 3))} /></div>
            <button className="press btn primary" style={{ marginTop: 12, width: '100%' }} onClick={() => { updateAdult((current) => ({ ...current, name: name.trim() || current.name, target: Number(target) || current.target })); showToast('保存しました') }}>保存</button>
          </div>
          <div className="a-card row">
            <div style={{ flex: 1 }}><div className="t">大人側に入るとき PIN</div><div className="muted s">グチや仕事の話も記憶するので、オンをおすすめします</div></div>
            <button className={`toggle ${adultStore.pinRequired ? 'on' : ''}`} onClick={() => updateAdultStore((prev) => ({ ...prev, pinRequired: !prev.pinRequired }))}><i /></button>
          </div>
          <div className="a-card">
            <div className="t">この人のデータを消す</div>
            <div className="muted s" style={{ marginBottom: 10 }}>記憶・復習カード・TOEIC の記録がすべて消えます</div>
            {confirm
              ? <button className="press btn danger" style={{ width: '100%' }} onClick={() => { updateAdultStore((prev) => withoutAdult(prev, adult.id)); onSwitch() }}>本当に消す</button>
              : <button className="press btn ghost" style={{ width: '100%' }} onClick={() => setConfirm(true)}>消す…</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
