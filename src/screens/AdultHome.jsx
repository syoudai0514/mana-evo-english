import React, { useState } from 'react'
import { ADULT_PARTNERS } from '../data/adult.js'
import { dueCards, greetingFor, todayPlan, withoutAdult } from '../lib/adult.js'
import {
  adultLearningDays,
  validToeicTarget,
  weekTrail
} from '../lib/journey.js'
import { unlockSpeech } from '../lib/tts.js'
import { readAloud } from '../lib/reader.js'
import { Brand, Icon, WeekTrail } from '../components/experience.jsx'
import { LoginCard } from './Parent.jsx'
import PrivacyPanel from '../components/PrivacyPanel.jsx'

const FOCUS = {
  speak: {
    label: '話せるように',
    icon: 'chat',
    eyebrow: 'MAKE IT YOUR ENGLISH',
    title: (
      <>
        伝えたいことを、
        <br />
        あなたの英語で。
      </>
    ),
    about: 'うまく話すより、まずひとこと。今日あったことから話そう。',
    action: '会話をはじめる',
    kind: 'chat',
    detail: '日常のこと・好きなこと、なんでも。'
  },
  toeic: {
    label: 'TOEIC 対策',
    icon: 'book',
    eyebrow: 'ONE QUESTION AT A TIME',
    title: (
      <>
        「わかる」を増やす。
        <br />
        目標の、その先へ。
      </>
    ),
    about: '短い問題で苦手を見つけて、理解をひとつずつ積み上げよう。',
    action: 'TOEIC の学習へ',
    screen: 'toeicStats',
    detail: '基礎チェック・苦手分野・学習記録'
  },
  listen: {
    label: '耳から学ぶ',
    icon: 'headphones',
    eyebrow: 'A LITTLE LISTENING BREAK',
    title: (
      <>
        いつもの移動を、
        <br />
        英語の時間に。
      </>
    ),
    about: '声を出せないときも。会話やフレーズを、自分のペースで。',
    action: '聞くコンテンツを選ぶ',
    screen: 'train',
    detail: '会話・TOEIC リスニング・耳で復習'
  }
}
const STEP_LABELS = {
  review: '言い方を復習',
  shadow: '声に出してまねる',
  chat: '今日のことを話す',
  toeic: '苦手をひとつ解消',
  diagnosis: 'TOEIC 基礎チェック'
}
export default function AdultHome({
  adult,
  adultStore,
  updateAdult,
  updateAdultStore,
  navigate,
  showToast,
  onStart,
  onSwitch, onLibrary
}) {
  const [short, setShort] = useState(true)
  const [settings, setSettings] = useState(false)
  const partner = ADULT_PARTNERS[adult.partner] || ADULT_PARTNERS.alex
  const focus = Object.hasOwn(FOCUS, adult.focus) ? adult.focus : 'speak'
  const active = FOCUS[focus]
  const greeting = greetingFor(adult)
  const plan = todayPlan(adult, { short })
  const minutes = plan.reduce((sum, step) => sum + step.minutes, 0)
  const due = dueCards(adult, Date.now(), 999).length
  const start = (kind, steps) => {
    unlockSpeech()
    onStart(kind, steps)
  }
  const runSteps = (steps) =>
    start(
      'plan',
      steps.map((step) =>
        step.id === 'chat' ? { ...step, course: 'chat' } : step
      )
    )
  if (settings)
    return (
      <AdultSettings
        adult={adult}
        adultStore={adultStore}
        updateAdult={updateAdult}
        updateAdultStore={updateAdultStore}
        showToast={showToast}
        onBack={() => setSettings(false)}
        onSwitch={onSwitch}
        navigate={navigate}
      />
    )
  return (
    <div className="screen adult-dark adult-home">
      <div className="scroll">
        <header className="experience-header">
          <Brand adult />
          <div className="header-actions">
            <button className="profile-switch" onClick={onSwitch}>
              <span>{adult.emoji}</span>
              {adult.name}
              <span className="switch-caption">きりかえ</span>
            </button>
            <button
              className="icon-btn"
              aria-label="学習とログインの設定"
              onClick={() => setSettings(true)}
            >
              <Icon name="settings" />
            </button>
          </div>
        </header>
        <main className="dashboard-content">
          <div className="page-intro">
            <div>
              <span className="eyebrow">YOUR DAILY ENGLISH</span>
              <h1>今日は、どんな一歩にしよう。</h1>
              <p>5分の日も、じっくりの日も。自分のペースで。</p>
            </div>
            <span className="studio-label">
              <span /> MY LEARNING STUDIO
            </span>
          </div>
          <div
            className="focus-picker"
            role="group"
            aria-label="今日の学習目的"
          >
            {Object.entries(FOCUS).map(([id, item]) => (
              <button
                key={id}
                aria-pressed={focus === id}
                className={focus === id ? 'selected' : ''}
                onClick={() =>
                  updateAdult((current) => ({ ...current, focus: id }))
                }
              >
                <Icon name={item.icon} size={19} />
                {item.label}
              </button>
            ))}
          </div>
          <div className="adult-layout">
            <section className={`focus-hero focus-${focus}`}>
              <div className="focus-copy">
                <span className="eyebrow">{active.eyebrow}</span>
                <h2>{active.title}</h2>
                <p>{active.about}</p>
                <button
                  className="primary-action"
                  onClick={() =>
                    active.screen ? navigate(active.screen) : start(active.kind)
                  }
                >
                  {active.action}
                  <Icon name="arrow" size={20} />
                </button>
                <span className="hero-detail">{active.detail}</span>
              </div>
              <div className="studio-art" aria-hidden="true">
                <div className="studio-disc disc-one" />
                <div className="studio-disc disc-two" />
                <div className="phrase-card">
                  <Icon name={active.icon} size={34} />
                  <span>
                    {focus === 'speak'
                      ? 'Small talk.'
                      : focus === 'toeic'
                        ? 'Small steps.'
                        : 'Press play.'}
                    <br />
                    <b>Big possibilities.</b>
                  </span>
                  <div className="sound-bars">
                    {[12, 22, 35, 20, 40, 28, 16, 34, 22].map((height, i) => (
                      <i key={i} style={{ height }} />
                    ))}
                  </div>
                </div>
                <span className="studio-star">✳</span>
              </div>
            </section>
            <aside className="study-overview">
              <span className="eyebrow">YOUR PROGRESS</span>
              <h2>少しずつ、身についている。</h2>
              <WeekTrail days={weekTrail(adultLearningDays(adult))} />
              <div className="learning-metrics">
                <div>
                  <strong>
                    {adult.sessions.length}
                    <small>回</small>
                  </strong>
                  <span>保存された会話</span>
                </div>
                <div>
                  <strong>
                    {adult.cards.length}
                    <small>枚</small>
                  </strong>
                  <span>あなたのフレーズ</span>
                </div>
              </div>
              <button
                className="review-shortcut"
                onClick={() =>
                  adult.cards.length ? start('review') : start('chat')
                }
              >
                <Icon name="book" size={20} />
                <span>
                  {due
                    ? `今日の復習 ${due}枚`
                    : adult.cards.length
                      ? 'フレーズを復習する'
                      : '会話からフレーズを集める'}
                </span>
                <Icon name="arrow" size={18} />
              </button>
            </aside>
          </div>
          <section className="new-library-banner"><span>📚</span><div><h2>場面から選べる教材ライブラリ</h2><p>ガイド会話・聞く練習・フレーズ・声に出す練習</p></div><button className="primary-action" onClick={() => onLibrary('conversation')}>教材を選ぶ <Icon name="arrow" /></button></section>
          <div className="adult-lower-grid">
            <section className="plan-panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">A ROUTINE THAT FITS</span>
                  <h2>今日のおすすめ</h2>
                </div>
                <div className="seg" role="group" aria-label="学習量">
                  <button
                    className={short ? 'on' : ''}
                    aria-pressed={short}
                    onClick={() => setShort(true)}
                  >
                    短め
                  </button>
                  <button
                    className={!short ? 'on' : ''}
                    aria-pressed={!short}
                    onClick={() => setShort(false)}
                  >
                    じっくり
                  </button>
                </div>
              </div>
              <p className="section-note">
                目安 {minutes}分 · ひとつだけ選んでもOK
              </p>
              <div className="routine-list">
                {plan.map((step, index) => (
                  <button
                    key={step.id}
                    className="routine-step"
                    onClick={() => runSteps([step])}
                  >
                    <span className="routine-number">0{index + 1}</span>
                    <span>
                      {STEP_LABELS[step.id]}
                      <small>
                        {step.count
                          ? `${step.count}${step.id === 'review' ? '枚' : step.id === 'shadow' ? '文' : '問'}`
                          : `${partner.name} と会話`}
                      </small>
                    </span>
                    <span className="routine-time">
                      {step.minutes}分<Icon name="arrow" size={16} />
                    </span>
                  </button>
                ))}
              </div>
              <button className="plan-start" onClick={() => runSteps(plan)}>
                このプランではじめる
                <Icon name="arrow" size={18} />
              </button>
              <button
                className="memory-link"
                onClick={() => start('chatStudy')}
              >
                会話のあとにミニ問題も解く →
              </button>
            </section>
            <section className="practice-panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">ENGLISH FOR YOUR LIFE</span>
                  <h2>使いたい場面から</h2>
                </div>
              </div>
              <div className="practice-grid">
                {[
                  ['💼', '仕事で話す', '会議・報告・依頼', 'work'],
                  ['🧳', '旅先で話す', 'ホテル・レストラン', 'travel'],
                  ['🌱', 'おうち英語', '子どもへの声かけ', 'kid'],
                  ['🎧', '声に出す', '会話の文をまねる', 'shadow']
                ].map(([emoji, title, about, kind]) => (
                  <button
                    key={kind}
                    className="practice-tile"
                    onClick={() => start(kind)}
                  >
                    <span>{emoji}</span>
                    <strong>{title}</strong>
                    <small>{about}</small>
                  </button>
                ))}
              </div>
              <button
                className="partner-note"
                onClick={() => {
                  unlockSpeech()
                  readAloud(greeting.en)
                }}
              >
                <span className="partner-avatar">{partner.emoji}</span>
                <span>
                  <strong>{greeting.en}</strong>
                  <small>{partner.name} · タップして聞く</small>
                </span>
              </button>
              <button
                className="memory-link"
                onClick={() => navigate('adultMemory')}
              >
                会話の記憶を確認・削除
                <Icon name="arrow" size={16} />
              </button>
            </section>
          </div>
          <footer className="studio-footer">
            <span>目標 TOEIC {adult.target}</span>
            <button onClick={() => navigate('toeicStats')}>
              学習記録をみる ↗
            </button>
            <button onClick={() => setSettings(true)}>ログイン・設定</button>
          </footer>
        </main>
      </div>
    </div>
  )
}
function AdultSettings({
  adult,
  adultStore,
  updateAdult,
  updateAdultStore,
  showToast,
  onBack,
  onSwitch, navigate
}) {
  const [name, setName] = useState(adult.name)
  const [target, setTarget] = useState(String(adult.target))
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="screen adult-dark">
      <div className="top">
        <button className="icon-btn" onClick={onBack}>
          ‹
        </button>
        <div className="pill">⚙️ 設定</div>
        <div style={{ width: 42 }} />
      </div>
      <div className="scroll">
        <div className="a-section">
          <LoginCard showToast={showToast} />
          <PrivacyPanel showToast={showToast} />
          <div className="a-card"><button className="primary-action" onClick={() => navigate('cloudSettingsAdult')}>保存・連携・データ管理へ →</button></div>
          <div className="a-card">
            <div className="field">
              <label htmlFor="settings-name">よび名</label>
              <input
                id="settings-name"
                value={name}
                maxLength={10}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="settings-target">
                TOEIC の目標スコア（10〜990、5点刻み）
              </label>
              <input
                id="settings-target"
                inputMode="numeric"
                value={target}
                onChange={(event) =>
                  setTarget(event.target.value.replace(/\D/g, '').slice(0, 3))
                }
              />
            </div>
            <button
              disabled={!name.trim() || !validToeicTarget(target)}
              className="press btn primary"
              style={{ marginTop: 12, width: '100%' }}
              onClick={() => {
                updateAdult((current) => ({
                  ...current,
                  name: name.trim() || current.name,
                  target: Number(target) || current.target
                }))
                showToast('保存しました')
              }}
            >
              保存
            </button>
          </div>
          <div className="a-card row">
            <div style={{ flex: 1 }}>
              <div className="t">大人側に入るとき PIN</div>
              <div className="muted s">
                子供の誤操作を防ぎます。端末のデータを暗号化する機能ではありません
              </div>
            </div>
            <button
              role="switch"
              aria-label="大人の画面に入るとき PIN を使う"
              aria-checked={adultStore.pinRequired}
              className={`toggle ${adultStore.pinRequired ? 'on' : ''}`}
              onClick={() =>
                updateAdultStore((prev) => ({
                  ...prev,
                  pinRequired: !prev.pinRequired
                }))
              }
            >
              <i />
            </button>
          </div>
          <div className="a-card">
            <div className="t">この人のデータを消す</div>
            <div className="muted s" style={{ marginBottom: 10 }}>
              記憶・復習カード・TOEIC の記録がすべて消えます
            </div>
            {confirm ? (
              <button
                className="press btn danger"
                style={{ width: '100%' }}
                onClick={() => {
                  updateAdultStore((prev) => withoutAdult(prev, adult.id))
                  onSwitch()
                }}
              >
                本当に消す
              </button>
            ) : (
              <button
                className="press btn ghost"
                style={{ width: '100%' }}
                onClick={() => setConfirm(true)}
              >
                消す…
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
