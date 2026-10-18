import React, { useMemo, useState } from 'react'
import { LEVELS, levelOf } from '../data/levels.js'
import { PERSONAS, personaOf } from '../data/personas.js'
import { pickTopic } from '../data/topics.js'
import { PIN_KEY, initialState, todaySummary } from '../lib/state.js'
import { currentEmail, isSignedIn, signIn, signOut } from '../lib/auth.js'
import { isMockMode } from '../lib/config.js'
import { speak, unlockSpeech } from '../lib/tts.js'
import { TabBar } from '../components/ui.jsx'

function storedPin() {
  try { return localStorage.getItem(PIN_KEY) || '' } catch { return '' }
}

// mana-evo と同じ 4けたの PIN。忘れたときは大人向けの計算で再設定できる
export function PinGate({ onUnlock, onBack }) {
  const [phase, setPhase] = useState(() => (storedPin() ? 'enter' : 'create'))
  const [pin, setPin] = useState('')
  const [first, setFirst] = useState('')
  const [message, setMessage] = useState('')
  const quiz = useMemo(() => { const a = 23 + Math.floor(Math.random() * 60); const b = 12 + Math.floor(Math.random() * 30); return { a, b } }, [])
  const [answer, setAnswer] = useState('')

  const press = (digit) => {
    const next = (pin + digit).slice(0, 4)
    setPin(next)
    setMessage('')
    if (next.length < 4) return
    setTimeout(() => {
      if (phase === 'enter') {
        if (next === storedPin()) onUnlock()
        else { setMessage('PINが ちがいます'); setPin('') }
      } else if (phase === 'create') {
        setFirst(next); setPin(''); setPhase('confirm')
      } else if (phase === 'confirm') {
        if (next === first) { try { localStorage.setItem(PIN_KEY, next) } catch {} onUnlock() }
        else { setMessage('2かい おなじ PIN を いれてください'); setPin(''); setPhase('create') }
      }
    }, 120)
  }

  if (phase === 'forgot') {
    return (
      <div className="screen parent">
        <div className="top"><button className="icon-btn" onClick={() => setPhase('enter')}>‹</button><div className="title-lg">PINの再設定</div><div style={{ width: 42 }} /></div>
        <div className="card">
          <p style={{ fontSize: 14, fontWeight: 700 }}>保護者の確認です。答えを入力してください。</p>
          <p className="en" style={{ fontSize: 28, fontWeight: 800, margin: '10px 0' }}>{quiz.a} × {quiz.b} = ?</p>
          <div className="field"><input inputMode="numeric" value={answer} onChange={(event) => setAnswer(event.target.value)} /></div>
          <button className="press btn primary" style={{ width: '100%', marginTop: 12 }} onClick={() => {
            if (Number(answer) === quiz.a * quiz.b) { setPhase('create'); setPin(''); setMessage('あたらしい PIN を きめてください') }
            else setMessage('答えがちがいます')
          }}>確認</button>
          {message && <p style={{ color: '#D0453A', fontWeight: 700, fontSize: 13, marginTop: 8 }}>{message}</p>}
        </div>
      </div>
    )
  }

  const titles = { enter: '保護者PINを入力', create: '保護者PINを決める（4けた）', confirm: 'もう一度入力してください' }
  return (
    <div className="screen parent">
      <div className="top"><button className="icon-btn" onClick={onBack}>‹</button><div className="title-lg">おうちのひと</div><div style={{ width: 42 }} /></div>
      <div className="center" style={{ marginTop: 30 }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <div style={{ fontWeight: 900, fontSize: 17, marginTop: 6 }}>{titles[phase]}</div>
        <div className="pin-dots">{[0, 1, 2, 3].map((i) => <i key={i} className={pin.length > i ? 'on' : ''} />)}</div>
        <div style={{ minHeight: 20, color: '#D0453A', fontWeight: 700, fontSize: 13 }}>{message}</div>
      </div>
      <div className="keypad" style={{ marginTop: 10 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} onClick={() => press(d)}>{d}</button>)}
        <button style={{ fontSize: 13, fontFamily: 'var(--jp)', fontWeight: 900 }} onClick={() => phase === 'enter' && setPhase('forgot')}>{phase === 'enter' ? 'わすれた' : ''}</button>
        <button onClick={() => press('0')}>0</button>
        <button onClick={() => setPin((v) => v.slice(0, -1))}>⌫</button>
      </div>
    </div>
  )
}

function LoginCard({ showToast }) {
  const [signedIn, setSignedIn] = useState(isSignedIn())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mock = isMockMode()

  if (signedIn) {
    return (
      <div className="card">
        <h3>🔌 AIのせつぞく</h3>
        <p style={{ fontSize: 13, fontWeight: 700 }}>✅ ログイン中：{currentEmail()}</p>
        {mock && <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>いまは確認用のダミー相手（mock）で動いています。</p>}
        <button className="btn danger" style={{ marginTop: 10 }} onClick={() => { signOut(); setSignedIn(false) }}>ログアウト</button>
      </div>
    )
  }
  return (
    <div className="card">
      <h3>🔌 AIのせつぞく</h3>
      <p style={{ fontSize: 12.5, lineHeight: 1.6 }}>mana-evo と同じアカウント（メールとパスワード）でログインすると、AIとおしゃべりできます。</p>
      <form onSubmit={async (event) => {
        event.preventDefault()
        setBusy(true); setError('')
        try { await signIn(email.trim(), password); setSignedIn(true); showToast('ログインしました') }
        catch (err) { setError(err.message) }
        finally { setBusy(false) }
      }}>
        <div className="field"><label>メールアドレス</label><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <div className="field"><label>パスワード</label><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        {error && <p style={{ color: '#D0453A', fontWeight: 700, fontSize: 13, marginTop: 8 }}>{error}</p>}
        <button className="press btn primary" style={{ width: '100%', marginTop: 12 }} disabled={busy || !email || !password}>{busy ? 'ログイン中…' : 'ログイン'}</button>
      </form>
    </div>
  )
}

function SessionDetail({ session, nickname, onBack }) {
  const persona = personaOf(session.partner)
  return (
    <div className="screen parent">
      <div className="top"><button className="icon-btn" onClick={onBack}>‹</button><div className="title-lg">{session.emoji} {session.title}</div><div style={{ width: 42 }} /></div>
      <div className="scroll">
        <div className="card">
          <p className="muted" style={{ fontSize: 12, fontWeight: 700 }}>{new Date(session.startedAt).toLocaleString('ja-JP')}</p>
          {session.turns.map((turn, index) => (
            <div key={index} className="log-line">
              {turn.who === 'partner' ? (
                <><b style={{ color: 'var(--grape)' }}>{persona.name}</b> <span className="en" style={{ fontSize: 14, fontWeight: 600 }}>{turn.text}</span><br /><span className="muted">{turn.ja}</span></>
              ) : (
                <><b style={{ color: 'var(--sky-d)' }}>{nickname}</b> <span className={turn.english ? 'en' : ''} style={{ fontSize: 14, fontWeight: 600 }}>{turn.text}</span>{' '}
                  {turn.english
                    ? <span className="tag" style={{ background: '#E3F8F0', color: 'var(--mint-d)' }}>英語で返答</span>
                    : <span className="tag" style={{ background: '#FFF1D6', color: '#B07A00' }}>日本語→言い直し</span>}
                  {turn.recast && <><br /><span className="muted en" style={{ fontSize: 13 }}>→ {turn.recast}</span></>}
                </>
              )}
            </div>
          ))}
        </div>
        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}

function homeCard(state) {
  const sessions = [...state.sessions].reverse().filter((session) => session.mode !== 'adult')
  for (const session of sessions) {
    const question = [...session.turns].reverse().find((turn) => turn.who === 'partner' && /\?\s*$/.test(turn.text) && turn.text.length < 60)
    if (question) return question
  }
  return null
}

export default function Parent({ state, update, navigate, showToast, onStart }) {
  const [unlocked, setUnlocked] = useState(false)
  const [detail, setDetail] = useState(null)
  const [view, setView] = useState('main') // main | settings
  const [nickname, setNickname] = useState(state.profile?.nickname || '')

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} onBack={() => navigate('home')} />
  if (detail) return <SessionDetail session={detail} nickname={state.profile?.nickname} onBack={() => setDetail(null)} />

  const summary = todaySummary(state)
  const level = levelOf(state.level)
  const card = homeCard(state)
  const kidSessions = [...state.sessions].reverse().filter((session) => session.mode !== 'adult').slice(0, 8)
  const persona = personaOf(state.profile?.partner)

  if (view === 'settings') {
    return (
      <div className="screen parent">
        <div className="top"><button className="icon-btn" onClick={() => setView('main')}>‹</button><div className="title-lg">⚙️ 設定</div><div style={{ width: 42 }} /></div>
        <div className="scroll">
          <div className="card">
            <h3>あだな</h3>
            <div className="field"><input value={nickname} maxLength={12} onChange={(event) => setNickname(event.target.value)} /></div>
            <button className="press btn primary" style={{ marginTop: 10 }} disabled={!nickname.trim()} onClick={() => { update((prev) => ({ ...prev, profile: { ...prev.profile, nickname: nickname.trim() } })); showToast('あだなを変更しました') }}>保存</button>
          </div>
          <div className="card">
            <h3>あいぼう</h3>
            {Object.values(PERSONAS).map((item) => (
              <button key={item.id} className="list-btn" onClick={() => { update((prev) => ({ ...prev, profile: { ...prev.profile, partner: item.id } })); speak(`Hi! I'm ${item.nameEn}!`, item.voice) }}>
                <span>{item.name}</span><span>{state.profile?.partner === item.id ? '✅' : ''}</span>
              </button>
            ))}
          </div>
          <div className="card">
            <h3>会話のAI（Live）</h3>
            {[['auto', 'おまかせ（3 Flash Live → 3.8 Live → 2.5 Native Audio）'], ['3-flash', 'Gemini 3 Flash Live（速い）'], ['3.8', 'Gemini 3.8 Live（かしこい）'], ['2.5-audio', 'Gemini 2.5 Flash Native Audio Dialog']].map(([id, label]) => (
              <button key={id} className="list-btn" onClick={() => { update((prev) => ({ ...prev, liveModel: id })); showToast(`${label} にしました`) }}>
                <span>{label}</span><span>{(state.liveModel || 'auto') === id ? '✅' : ''}</span>
              </button>
            ))}
            <p className="muted" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
              返事の速さや声を聞き比べたいときに切り替えてください。{state.liveModelName ? `前回つながったモデル：${state.liveModelName}` : 'まだ Live につながったことはありません。'}
            </p>
            {state.liveError && (
              <p style={{ fontSize: 11.5, marginTop: 6, color: '#D0453A', lineHeight: 1.5, wordBreak: 'break-all' }}>
                前回 Live につながらなかった理由：{state.liveError.model || state.liveError.choice} / {state.liveError.message}
              </p>
            )}
          </div>
          <div className="card">
            <h3>PIN</h3>
            <button className="btn ghost" onClick={() => { try { localStorage.removeItem(PIN_KEY) } catch {} showToast('次回ひらくときに新しいPINを決めます') }}>PINを変更する</button>
          </div>
          <div className="card">
            <h3>データ</h3>
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>会話の記録・シール・相棒の記憶をすべて消して、はじめからにします。</p>
            <button className="btn danger" style={{ marginTop: 8 }} onClick={() => {
              if (!window.confirm('本当にすべて消しますか？')) return
              update(() => initialState())
              navigate('setup')
            }}>すべてリセット</button>
          </div>
          <div style={{ height: 24 }} />
        </div>
      </div>
    )
  }

  return (
    <div className="screen parent">
      <div className="top">
        <div className="title-lg" style={{ fontSize: 22 }}>おうちのひと</div>
        <button className="icon-btn" onClick={() => setView('settings')}>⚙️</button>
      </div>
      <div className="scroll">
        <div className="stats">
          <div className="stat"><div className="k">きょう</div><div className="v">{summary.minutes}<span style={{ fontSize: 13 }}>分</span></div></div>
          <div className="stat"><div className="k">英語で返せた</div><div className="v" style={{ color: 'var(--mint-d)' }}>{summary.englishTurns}<span style={{ fontSize: 13 }}>/{summary.childTurns}</span></div></div>
          <div className="stat"><div className="k">新しい表現</div><div className="v" style={{ color: 'var(--coral)' }}>{summary.newPhrases}</div></div>
        </div>

        <div className="card">
          <h3>🌱 いまの段階 <span className="muted" style={{ fontSize: 11, fontWeight: 700 }}>（タップで変更）</span></h3>
          <div className="stage">
            {LEVELS.map((item) => (
              <button key={item.level} className={`${item.level <= state.level ? 'on' : ''} ${item.level === state.level ? 'cur' : ''}`}
                onClick={() => update((prev) => ({ ...prev, level: item.level }))}>
                <div className="bar" />
                <div className="lb">{item.label}</div>
              </button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>
            段階{level.level}：{level.japanese === 'english-only' ? '全部英語で話します。読みは発音記号。' : '日本語も分かってくれます（返事は英語）。'}
            段階4まではお子さんの会話から自動で上がります。段階5（英検3級くらい）は手動で切り替えてください。
          </p>
        </div>

        <LoginCard showToast={showToast} />

        {card && (
          <div className="card home-card">
            <h3>🏠 おうち英語カード</h3>
            <button className="en" style={{ fontSize: 21, fontWeight: 800, textAlign: 'left', lineHeight: 1.2 }} onClick={() => speak(card.text, { rate: 0.85 })}>{card.text} 🔊</button>
            <div className="muted" style={{ fontSize: 12.5, fontWeight: 700, marginTop: 4 }}>{card.ja}</div>
            <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>お風呂や寝る前に、この英語で話しかけてみてください。英語で返せたら大成功！</div>
          </div>
        )}

        <div className="card">
          <h3>💬 会話の記録</h3>
          {kidSessions.length === 0 && <p className="muted" style={{ fontSize: 13 }}>まだ記録がありません</p>}
          {kidSessions.map((session) => {
            const child = session.turns.filter((turn) => turn.who === 'child')
            const en = child.filter((turn) => turn.english).length
            return (
              <button key={session.id} className="list-btn" onClick={() => setDetail(session)}>
                <span>{session.emoji} {session.title}<br /><span className="muted" style={{ fontSize: 11.5 }}>{new Date(session.startedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}・英語 {en}/{child.length}</span></span>
                <span className="muted">›</span>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '12px 20px 24px' }}>
          <button className="press btn primary" style={{ flex: 1, height: 52 }} onClick={() => navigate('who')}>🧔 大人モードへ</button>
          <button className="press btn ghost" style={{ flex: 1, height: 52 }} onClick={() => { unlockSpeech(); onStart({ mode: 'free', partner: persona.id, topic: pickTopic({ recentIds: state.recentTopics }), parentReads: true }) }}>👨‍👦 親子モード</button>
        </div>
      </div>
      <TabBar current="parent" onNavigate={navigate} />
    </div>
  )
}
