import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadState, saveState, withSessionEnd } from './lib/state.js'
import {
  loadAdultStore, saveAdultStore, updateAdult as updateAdultIn, withAdultSession, withStudyDay, memoryForTalk, dueCards,
  weakSkills, greetingFor
} from './lib/adult.js'
import { ADULT_COURSES, ADULT_PARTNERS } from './data/adult.js'
import { pickTopic } from './data/topics.js'
import { primePlayback } from './lib/audio.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Setup from './screens/Setup.jsx'
import Home from './screens/Home.jsx'
import Talk from './screens/Talk.jsx'
import PlayPicker from './screens/PlayPicker.jsx'
import GuessPicker from './screens/GuessPicker.jsx'
import Result from './screens/Result.jsx'
import Stickers from './screens/Stickers.jsx'
import Friends from './screens/Friends.jsx'
import Parent, { PinGate } from './screens/Parent.jsx'
import Who from './screens/Who.jsx'
import AdultHome from './screens/AdultHome.jsx'
import Review from './screens/Review.jsx'
import Shadow from './screens/Shadow.jsx'
import Quiz from './screens/Quiz.jsx'
import Toeic from './screens/Toeic.jsx'
import AdultResult from './screens/AdultResult.jsx'
import AdultMemory from './screens/AdultMemory.jsx'
import { Toast } from './components/ui.jsx'

// 大人の1回の学習（きょうのメニュー、またはコース1つ）を何段階で進めるか
function stepsFor(kind, adult, plan) {
  if (kind === 'plan') return plan
  if (kind === 'chatStudy') return [{ id: 'chat', course: 'chatStudy', minutes: ADULT_COURSES.chatStudy.chatMinutes }, { id: 'study' }]
  if (kind in ADULT_COURSES) return [{ id: 'chat', course: kind }]
  if (kind === 'toeic') return [{ id: 'toeic' }]
  if (kind === 'diagnosis') return [{ id: 'diagnosis' }]
  if (kind === 'review') return [{ id: 'review' }]
  if (kind === 'shadow') return [{ id: 'shadow' }]
  return []
}

export default function App() {
  const [state, setState] = useState(() => loadState())
  const [adultStore, setAdultStore] = useState(() => loadAdultStore())
  // 大人がいれば、起動したら「だれが はなす？」から
  const [screen, setScreen] = useState(() => (!loadState().profile ? 'setup' : loadAdultStore().order.length ? 'who' : 'home'))
  const [talkConfig, setTalkConfig] = useState(null)
  const [result, setResult] = useState(null)
  const [toast, setToast] = useState('')
  const [run, setRun] = useState(null) // 大人の学習の進み具合 { steps, index, results, startedAt }
  const [adultUnlocked, setAdultUnlocked] = useState(false)
  const toastTimer = useRef(null)

  const stateRef = useRef(state)
  stateRef.current = state
  useEffect(() => { saveState(state) }, [state])
  useEffect(() => { saveAdultStore(adultStore) }, [adultStore])

  // ホームで相棒が話しかけてくる話題。起動ごとに選びなおす
  const [homeTopic, setHomeTopic] = useState(() => pickTopic({ recentIds: loadState().recentTopics }))

  const update = useCallback((fn) => setState((prev) => fn(prev)), [])
  const updateAdultStore = useCallback((fn) => setAdultStore((prev) => fn(prev)), [])
  const adult = adultStore.current ? adultStore.adults[adultStore.current] : null
  const adultId = adult?.id
  const updateAdult = useCallback((fn) => setAdultStore((prev) => updateAdultIn(prev, prev.current, fn)), [])

  const showToast = useCallback((message) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2400)
  }, [])

  const startTalk = useCallback((config) => {
    primePlayback() // タップの中で、相棒の声を鳴らせる状態にしておく（iPhone）
    setTalkConfig({ ...config, key: Date.now() })
    setScreen('talk')
  }, [])

  // ---------- 大人の学習の進行 ----------
  const adultRef = useRef(adult)
  adultRef.current = adult

  const openStep = (steps, index, results) => {
    const step = steps[index]
    const current = adultRef.current
    if (step.id === 'chat') {
      const course = ADULT_COURSES[step.course] || ADULT_COURSES.chat
      const greeting = greetingFor(current)
      const partner = ADULT_PARTNERS[current.partner] || ADULT_PARTNERS.alex
      setTalkConfig({
        key: Date.now(),
        mode: 'adult',
        partner: partner.id,
        adultPartner: partner,
        minutes: step.minutes || course.chatMinutes || 0,
        adultScene: {
          id: course.id,
          emoji: course.emoji,
          title: course.title,
          about: course.about,
          opener: course.opener || greeting.en,
          openerJa: course.opener ? '' : greeting.ja
        },
        adultCtx: {
          name: current.name,
          memory: memoryForTalk(current),
          phrases: dueCards(current, Date.now() + 2 * 86400000, 6).map((card) => card.en),
          weakSkills: weakSkills(current).map((row) => row.ja)
        }
      })
      setScreen('talk')
      return
    }
    setScreen(step.id === 'study' || step.id === 'toeic' || step.id === 'diagnosis' ? 'quiz' : step.id)
  }

  const startAdult = useCallback((kind, plan) => {
    primePlayback()
    const steps = stepsFor(kind, adultRef.current, plan)
    if (!steps.length) return
    const fresh = { steps, index: 0, results: {}, startedAt: new Date().toISOString() }
    runRef.current = fresh
    setRun(fresh)
    openStep(steps, 0, fresh.results)
  }, [])

  // 1段階が終わったら結果をまとめて次へ。最後（または途中でやめた）なら「きょうのまとめ」
  const runRef = useRef(run)
  runRef.current = run
  const finishStep = useCallback((stepResult = {}, { stop = false } = {}) => {
    const prev = runRef.current
    if (!prev) return
    const results = { ...prev.results }
    for (const [key, value] of Object.entries(stepResult)) {
      results[key] = Array.isArray(value) ? [...(results[key] || []), ...value] : typeof value === 'number' ? (results[key] || 0) + value : value
    }
    const index = prev.index + 1
    const next = { ...prev, index, results }
    runRef.current = next
    setRun(next)
    if (Object.keys(stepResult).length) updateAdult((current) => withStudyDay(current))
    if (stop || index >= prev.steps.length) setScreen(Object.keys(results).length ? 'adultResult' : 'adultHome')
    else openStep(prev.steps, index, results)
  }, [])

  const finishTalk = useCallback((session, { memoryAdded = [], cardsAdded = [], stopped = false } = {}) => {
    const childTurns = session.turns.filter((turn) => turn.who === 'child')
    if (session.mode === 'adult') {
      if (childTurns.length) updateAdult((current) => withAdultSession(current, session))
      const minutes = Math.max(0, (Date.now() - new Date(session.startedAt).getTime()) / 60000)
      const chat = childTurns.length
        ? {
            chatMinutes: minutes,
            sentences: childTurns.length,
            memoryAdded,
            cardsAdded,
            recasts: childTurns.filter((turn) => turn.recast || turn.tip).map((turn) => ({ said: turn.text, better: turn.recast, tip: turn.tip || '' })),
            chatContext: session.turns.map((turn) => `${turn.who === 'partner' ? 'Alex' : 'Me'}: ${turn.text}`).join('\n').slice(-1200)
          }
        : {}
      finishStep(chat, { stop: stopped }) // ✕ でやめたら、学習はそこまで（「お勉強へ」なら次へ進む）
      return
    }
    if (!childTurns.length) { setScreen('home'); return }
    const outcome = withSessionEnd(stateRef.current, session)
    setState(outcome.state)
    setResult({ record: outcome.record, completed: outcome.completed, memoryAdded })
    setHomeTopic(pickTopic({ recentIds: outcome.state.recentTopics }))
    setScreen('result')
  }, [])

  const navigate = useCallback((id) => setScreen(id), [])

  const chooseAdult = useCallback((id) => {
    setAdultStore((prev) => ({ ...prev, current: id }))
    setScreen(adultStore.pinRequired && !adultUnlocked ? 'adultPin' : 'adultHome')
  }, [adultStore.pinRequired, adultUnlocked])

  const common = useMemo(() => ({ state, update, navigate, showToast }), [state, update, navigate, showToast])
  const adultCommon = { adult, adultStore, updateAdult, updateAdultStore, navigate, showToast }
  const step = run?.steps[run.index]

  return (
    <div className="app">
      <ErrorBoundary key={screen} onReset={() => { setRun(null); setScreen(adult && adultStore.current ? 'adultHome' : 'home') }}>
      {screen === 'setup' && (
        <Setup
          onDone={(profile) => {
            update((prev) => ({ ...prev, profile: { ...profile, createdAt: new Date().toISOString() } }))
            setScreen('home')
          }}
        />
      )}
      {screen === 'home' && <Home {...common} topic={homeTopic} onStart={startTalk} />}
      {screen === 'play' && <PlayPicker {...common} onStart={startTalk} />}
      {screen === 'guess' && <GuessPicker {...common} onStart={startTalk} />}
      {screen === 'talk' && talkConfig && (
        <Talk
          key={talkConfig.key}
          {...common}
          config={talkConfig}
          onFinish={finishTalk}
          onAdultCard={talkConfig.mode === 'adult' ? (fn) => updateAdult(fn) : null}
        />
      )}
      {screen === 'result' && result && <Result {...common} result={result} />}
      {screen === 'stickers' && <Stickers {...common} />}
      {screen === 'friends' && <Friends {...common} />}
      {screen === 'parent' && <Parent {...common} onStart={startTalk} />}

      {screen === 'who' && <Who state={state} adultStore={adultStore} updateAdultStore={updateAdultStore} onKid={() => setScreen('home')} onAdult={chooseAdult} />}
      {screen === 'adultPin' && <PinGate onUnlock={() => { setAdultUnlocked(true); setScreen('adultHome') }} onBack={() => setScreen('who')} />}
      {screen === 'adultHome' && adult && <AdultHome {...adultCommon} onStart={startAdult} onSwitch={() => { setAdultUnlocked(false); setScreen('who') }} />}
      {screen === 'adultMemory' && adult && <AdultMemory {...adultCommon} />}
      {screen === 'toeicStats' && adult && <Toeic {...adultCommon} onStart={startAdult} />}
      {screen === 'review' && adult && <Review key={`r${run?.startedAt}`} {...adultCommon} onDone={finishStep} />}
      {screen === 'shadow' && adult && <Shadow key={`s${run?.startedAt}`} {...adultCommon} onDone={finishStep} />}
      {screen === 'quiz' && adult && step && (
        <Quiz key={`q${run.startedAt}${run.index}`} {...adultCommon} kind={step.id} recasts={run.results.recasts || []} context={run.results.chatContext || ''} onDone={finishStep} />
      )}
      {screen === 'adultResult' && adult && run && <AdultResult key={run.startedAt} {...adultCommon} run={run} onHome={() => { setRun(null); setScreen('adultHome') }} />}
      </ErrorBoundary>
      <Toast message={toast} />
    </div>
  )
}
