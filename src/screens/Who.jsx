import React, { useState } from 'react'
import { personaOf } from '../data/personas.js'
import { newAdult, withAdult } from '../lib/adult.js'
import { validToeicTarget } from '../lib/journey.js'
import { unlockSpeech } from '../lib/tts.js'
import { Brand, Icon } from '../components/experience.jsx'

const EMOJIS = ['🌿', '☕', '🌼', '🌙', '🧑', '🦊']
export default function Who({
  state,
  adultStore,
  updateAdultStore,
  onKid,
  onAdult
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🌿')
  const [target, setTarget] = useState('730')
  const persona = personaOf(state.profile?.partner, state.manaRoster)
  const add = (event) => {
    event.preventDefault()
    if (!name.trim() || !validToeicTarget(target)) return
    const adult = newAdult({ name: name.trim(), emoji, target: Number(target) })
    updateAdultStore((prev) => withAdult(prev, adult))
    unlockSpeech()
    onAdult(adult.id)
  }
  return (
    <div className="screen welcome-screen">
      <div className="scroll">
        <header className="experience-header">
          <Brand />
          <span className="header-note">小さな一歩が、世界をひらく。</span>
        </header>
        <main className="welcome-main">
          <div className="welcome-copy">
            <span className="eyebrow">A LITTLE ENGLISH, EVERY DAY</span>
            <h1>
              「はなしたい」が、
              <br />
              毎日を変える。
            </h1>
            <p>
              あいぼうと遊ぶ。自分のことを話す。
              <br />
              あなたらしい英語の時間を、ここから。
            </p>
          </div>
          <div className="welcome-art" aria-hidden="true">
            <span className="art-orbit" />
            <span className="hello-note">Hello, new world!</span>
            <img className="welcome-howamy" src="/monsters/m049.webp" alt="" />
            <img className="welcome-niji" src="/monsters/m186.webp" alt="" />
            <span className="art-star star-one">✦</span>
            <span className="art-star star-two">✧</span>
          </div>
          <section className="entry-grid" aria-label="学ぶ人を選ぶ">
            <button
              className="entry-card entry-kid"
              onClick={() => {
                unlockSpeech()
                onKid()
              }}
            >
              <span className="entry-icon">
                {state.profile ? (
                  <img src={persona.image} alt="" />
                ) : (
                  <Icon name="spark" size={30} />
                )}
              </span>
              <span className="eyebrow">FOR KIDS</span>
              <h2>
                {state.profile
                  ? `${state.profile.nickname}の ぼうけん`
                  : 'あそんで、なかよく。'}
              </h2>
              <p>
                あいぼうとおしゃべり、ごっこあそび。
                <br />
                ひとこと言えたら、もう大ぼうけん。
              </p>
              <span className="entry-link">
                {state.profile ? 'つづきから あそぶ' : 'あいぼうを えらぶ'}
                <Icon name="arrow" />
              </span>
            </button>
            <button
              className="entry-card entry-adult"
              onClick={() => setAdding(true)}
            >
              <span className="entry-icon">
                <Icon name="chat" size={30} />
              </span>
              <span className="eyebrow">FOR ADULTS</span>
              <h2>話せる自分へ、少しずつ。</h2>
              <p>
                日常会話から、仕事の英語、TOEICまで。
                <br />
                今日の気分で、自分だけの学び方を。
              </p>
              <span className="entry-link">
                大人の学習をはじめる
                <Icon name="arrow" />
              </span>
            </button>
          </section>
          {adultStore.order.length > 0 && (
            <section className="saved-learners">
              <h2>つづきから学ぶ</h2>
              <div>
                {adultStore.order.map((id) => {
                  const adult = adultStore.adults[id]
                  return (
                    <button
                      key={id}
                      className="learner-chip"
                      onClick={() => {
                        unlockSpeech()
                        onAdult(id)
                      }}
                    >
                      <span>{adult.emoji}</span>
                      {adult.name}
                      <Icon name="arrow" size={18} />
                    </button>
                  )
                })}
              </div>
            </section>
          )}
          {adding && (
            <form
              className="learner-form"
              onSubmit={add}
              aria-label="大人のプロフィール作成"
            >
              <div className="section-heading">
                <h2>あなたの学習スペース</h2>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="プロフィール作成を閉じる"
                  onClick={() => setAdding(false)}
                >
                  ×
                </button>
              </div>
              <div className="profile-fields">
                <div className="field">
                  <label htmlFor="adult-name">よび名</label>
                  <input
                    autoFocus
                    id="adult-name"
                    value={name}
                    maxLength={10}
                    placeholder="ニックネーム"
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="adult-target">
                    TOEIC 目標（あとで変更できます）
                  </label>
                  <input
                    id="adult-target"
                    type="number"
                    min="10"
                    max="990"
                    step="5"
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    required
                  />
                </div>
              </div>
              <div
                className="emoji-options"
                role="group"
                aria-label="プロフィールアイコン"
              >
                {EMOJIS.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={`emoji-pick ${emoji === item ? 'on' : ''}`}
                    aria-label={`アイコン ${item}`}
                    aria-pressed={emoji === item}
                    onClick={() => setEmoji(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <p className="form-help">
                記録はこの端末に保存されます。PIN
                は子供の誤操作を防ぐためのものです。AI
                会話は設定からログインすると使えます。
              </p>
              <button
                className="primary-action"
                disabled={!name.trim() || !validToeicTarget(target)}
              >
                学習スペースをつくる
                <Icon name="arrow" size={18} />
              </button>
            </form>
          )}
          <footer className="welcome-footer">
            <Icon name="leaf" size={16} /> たくさんより、ちょっとを毎日。
          </footer>
        </main>
      </div>
    </div>
  )
}
