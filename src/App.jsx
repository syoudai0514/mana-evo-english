import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadState, saveState, withSessionEnd } from './lib/state.js'
import { pickTopic } from './data/topics.js'
import Setup from './screens/Setup.jsx'
import Home from './screens/Home.jsx'
import Talk from './screens/Talk.jsx'
import PlayPicker from './screens/PlayPicker.jsx'
import GuessPicker from './screens/GuessPicker.jsx'
import Result from './screens/Result.jsx'
import Stickers from './screens/Stickers.jsx'
import Friends from './screens/Friends.jsx'
import Parent from './screens/Parent.jsx'
import { Toast } from './components/ui.jsx'

export default function App() {
  const [state, setState] = useState(() => loadState())
  const [screen, setScreen] = useState(() => (loadState().profile ? 'home' : 'setup'))
  const [talkConfig, setTalkConfig] = useState(null)
  const [result, setResult] = useState(null)
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  const stateRef = useRef(state)
  stateRef.current = state
  useEffect(() => { saveState(state) }, [state])

  // ホームで相棒が話しかけてくる話題。起動ごとに選びなおす
  const [homeTopic, setHomeTopic] = useState(() => pickTopic({ recentIds: loadState().recentTopics }))

  const update = useCallback((fn) => setState((prev) => fn(prev)), [])

  const showToast = useCallback((message) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2400)
  }, [])

  const startTalk = useCallback((config) => {
    setTalkConfig({ ...config, key: Date.now() })
    setScreen('talk')
  }, [])

  const finishTalk = useCallback((session, { memoryAdded = [] } = {}) => {
    const childTurns = session.turns.filter((turn) => turn.who === 'child').length
    if (!childTurns) { setScreen(session.mode === 'adult' ? 'parent' : 'home'); return }
    const outcome = withSessionEnd(stateRef.current, session)
    setState(outcome.state)
    setResult({ record: outcome.record, completed: outcome.completed, memoryAdded })
    setHomeTopic(pickTopic({ recentIds: outcome.state.recentTopics }))
    setScreen(session.mode === 'adult' ? 'parent' : 'result')
  }, [])

  const navigate = useCallback((id) => setScreen(id), [])

  const common = useMemo(() => ({ state, update, navigate, showToast }), [state, update, navigate, showToast])

  return (
    <div className="app">
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
        <Talk key={talkConfig.key} {...common} config={talkConfig} onFinish={finishTalk} />
      )}
      {screen === 'result' && result && <Result {...common} result={result} />}
      {screen === 'stickers' && <Stickers {...common} />}
      {screen === 'friends' && <Friends {...common} />}
      {screen === 'parent' && <Parent {...common} onStart={startTalk} />}
      <Toast message={toast} />
    </div>
  )
}
