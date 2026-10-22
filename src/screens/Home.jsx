import React, { useState } from 'react'
import { personaOf } from '../data/personas.js'
import { MODES } from '../data/modes.js'
import { levelOf } from '../data/levels.js'
import {
  letterToday,
  modelToday,
  todayKey,
  withLetterPlayed
} from '../lib/state.js'
import { kidLearningDays, weekTrail } from '../lib/journey.js'
import { speak, unlockSpeech } from '../lib/tts.js'
import { Hearts, Reading, TabBar } from '../components/ui.jsx'
import { Brand, Icon, WeekTrail } from '../components/experience.jsx'
import { nextReading } from '../lib/kana.js'

export default function Home({
  state,
  update,
  navigate,
  showToast,
  topic,
  onStart, onLibrary
}) {
  const persona = personaOf(state.profile?.partner, state.manaRoster)
  const level = levelOf(state.level)
  const [wiggle, setWiggle] = useState(false)
  const done = modelToday(state).done && state.liveDate !== todayKey()
  const voice = {
    ...persona.voice,
    rate: persona.voice.rate * level.speechRate
  }
  const days = kidLearningDays(state)
  const talkedToday = state.sessions.some(
    (session) =>
      session.endedAt &&
      session.mode !== 'adult' &&
      todayKey(new Date(session.endedAt)) === todayKey()
  )
  const letter = letterToday(state)
  const start = () => {
    unlockSpeech()
    onStart({ mode: 'free', partner: persona.id, topic })
  }
  const poke = () => {
    unlockSpeech()
    setWiggle(true)
    speak("Hi! Let's play together!", voice).finally(() => setWiggle(false))
  }
  return (
    <div className="screen kid-home">
      <div className="scroll">
        <header className="experience-header">
          <Brand />
          <button className="profile-switch" onClick={() => navigate('who')}>
            <Icon name="users" size={18} />
            <span>{state.profile?.nickname}</span>
            <span className="switch-caption">きりかえ</span>
          </button>
        </header>
        <main className="dashboard-content">
          <div className="page-intro">
            <div>
              <span className="eyebrow">MY LITTLE ADVENTURE</span>
              <h1>
                <span>きょうも、いっしょに</span>
                <wbr /> <span>あそぼう！</span>
              </h1>
              <p>ひとことから はじまる、きみの ぼうけん。</p>
            </div>
            <button
              className="collection-pill"
              onClick={() => navigate('stickers')}
            >
              <span>⭐</span>
              <strong>{state.stickers.length}</strong> シール
            </button>
          </div>
          <div className="kid-layout">
            <section
              className="adventure-card"
              aria-label="あいぼうとおしゃべり"
            >
              <div className="adventure-heading">
                <span className="soft-badge">✦ きょうの おしゃべり</span>
                <span className="adventure-caption">
                  {persona.name}と いっしょ
                </span>
              </div>
              <div className="garden-scene">
                <div className="garden-sun" />
                <div className="garden-cloud cloud-left" />
                <div className="garden-cloud cloud-right" />
                <div className="garden-hill hill-back" />
                <div className="garden-hill hill-front" />
                <span className="garden-flower flower-left">✿</span>
                <span className="garden-flower flower-right">✿</span>
                <span className="garden-spark">✦</span>
                <div className="garden-bubble">
                  <button
                    className="en"
                    onClick={() => {
                      unlockSpeech()
                      speak(topic.opener.en, voice)
                    }}
                  >
                    {topic.opener.en} <span aria-hidden="true">🔊</span>
                  </button>
                  <Reading
                    kana={topic.opener.kana}
                    policy={level.reading}
                    mode={state.reading}
                    onCycle={() =>
                      update((prev) => ({
                        ...prev,
                        reading: nextReading(prev.reading)
                      }))
                    }
                  />
                  {level.japanese !== 'english-only' && (
                    <p>{topic.opener.ja}</p>
                  )}
                </div>
                <button
                  className="buddy-button"
                  onClick={poke}
                  aria-label={`${persona.name}に あいさつする`}
                >
                  <img
                    src={persona.image} onError={event=>{event.currentTarget.onerror=null;event.currentTarget.src='/monsters/m049.webp'}}
                    alt={persona.name}
                    className={wiggle ? 'monster-wiggle' : 'monster-float'}
                  />
                </button>
                <div className="buddy-label">
                  {persona.name}
                  <Hearts points={state.friendship[persona.id] || 0} />
                </div>
              </div>
              <div className="adventure-action">
                <p>
                  {done
                    ? 'きょうも ありがとう。また あした！'
                    : 'にほんごでも、ひとことでも だいじょうぶ。'}
                </p>
                <button
                  className="primary-action"
                  disabled={done}
                  onClick={start}
                >
                  <Icon name="chat" />
                  {done ? 'また あした おはなししよう' : 'おはなし する！'}
                  <Icon name="arrow" />
                </button>
              </div>
            </section>
            <aside className="kid-side">
              <section className="daily-discovery">
                <div className="section-heading">
                  <h2>きょうの ちいさな いっぽ</h2>
                  <span>🌱</span>
                </div>
                <p>ひとつ できたら、はなまる！</p>
                <button
                  className="mission-row"
                  onClick={() =>
                    document
                      .getElementById('daily-letter')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                >
                  <span
                    className={`mission-check ${letter.played ? 'checked' : ''}`}
                  >
                    {letter.played ? <Icon name="check" size={18} /> : '1'}
                  </span>
                  <span>
                    もじの おとを きこう
                    <small>きょうは「{letter.item.letter}」</small>
                  </span>
                  <Icon name="arrow" size={17} />
                </button>
                <button className="mission-row" disabled={done} onClick={start}>
                  <span
                    className={`mission-check ${talkedToday ? 'checked' : ''}`}
                  >
                    {talkedToday ? <Icon name="check" size={18} /> : '2'}
                  </span>
                  <span>
                    あいぼうと はなそう
                    <small>
                      {talkedToday
                        ? 'きょうも はなせたね！'
                        : 'すきなことを ひとつ'}
                    </small>
                  </span>
                  <Icon name="arrow" size={17} />
                </button>
                <WeekTrail days={weekTrail(days)} kid />
              </section>
              <section id="daily-letter">
                <LetterCard
                  state={state}
                  update={update}
                  voice={voice}
                  navigate={navigate}
                />
              </section>
            </aside>
          </div>
          <section className="new-library-banner"><span>🌈</span><div><h2>ぼうけんの ほんだな</h2><p>60の ぼうけん・もじと おと・おはなし・せかいの ともだち</p></div><button className="primary-action" onClick={() => onLibrary('kids-activity')}>えらぶ <Icon name="arrow" /></button></section>
          <section className="play-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">MORE WAYS TO PLAY</span>
                <h2>なにして あそぶ？</h2>
              </div>
              <span className="section-note">すきなものを えらぼう</span>
            </div>
            <div className="play-grid">
              {['play', 'guess'].map((id) => (
                <button
                  className={`play-tile play-${id}`}
                  key={id}
                  disabled={done}
                  onClick={() => {
                    unlockSpeech()
                    if (done) return showToast('また あした！')
                    navigate(id)
                  }}
                >
                  <span className="play-emoji">{MODES[id].emoji}</span>
                  <span>
                    <h3>{MODES[id].title}</h3>
                    <p>
                      {id === 'play'
                        ? 'おみせやさんに なってみよう'
                        : 'ヒントを きいて あててみよう'}
                    </p>
                  </span>
                  <Icon name="arrow" />
                </button>
              ))}
            </div>
          </section>
          <p className="gentle-note">
            🌼 おやすみした日があっても、だいじょうぶ。また ここから。
          </p>
        </main>
      </div>
      <TabBar current="home" onNavigate={navigate} />
    </div>
  )
}
// きょうの もじ：大きな文字と絵。タップすると相棒の声で「S! sun! S is for sun!」。聞いたら ABC アルバムに入る
function LetterCard({ state, update, voice, navigate }) {
  const today = letterToday(state)
  const item = today.item
  const seen = Object.keys(state.lettersSeen || {}).length
  const play = () => {
    unlockSpeech()
    // 英語のあと、文字の名前と音のちがいを日本語で（フォニックスの いちばん大事なところ）
    speak(`${item.letter}! ${item.word}! ${item.letter} is for ${item.word}!`, {
      ...voice,
      rate: voice.rate * 0.9
    }).then(() =>
      speak(
        `「${item.name}」は、「${item.sound}」の おと。${item.wordKana}の「${item.sound}」`,
        { lang: 'ja-JP', rate: 1, pitch: 1.1 }
      )
    )
    if (!today.played) update((prev) => withLetterPlayed(prev))
  }
  return (
    <div className="letter-card-wrap">
      <button
        className={`press letter-card ${today.played ? 'done' : ''}`}
        onClick={play}
      >
        <div className="lc-label">
          きょうの もじ {today.played ? '✅' : '🔊'}
        </div>
        <div className="lc-body">
          <div className="lc-letter en">
            {item.letter}
            <span>{item.letter.toLowerCase()}</span>
          </div>
          <div className="lc-word">
            <div style={{ fontSize: 40, lineHeight: 1 }}>{item.emoji}</div>
            <div className="en" style={{ fontWeight: 800, fontSize: 18 }}>
              {item.word}
            </div>
            <div
              style={{ fontSize: 12, fontWeight: 900, color: 'var(--ink2)' }}
            >
              {item.wordKana}（{item.ja}）
            </div>
          </div>
        </div>
        <div className="lc-sound">
          「{item.name}」は「{item.sound}」の おと
        </div>
      </button>
      <button
        className="link-btn"
        style={{ display: 'block', margin: '6px auto 0' }}
        onClick={() => navigate('stickers')}
      >
        🔤 ABC アルバム {seen} / 26 ›
      </button>
    </div>
  )
}
