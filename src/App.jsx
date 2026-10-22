import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadState, saveState, withSessionEnd } from './lib/state.js'
import {
  loadAdultStore,
  saveAdultStore,
  updateAdult as updateAdultIn,
  withAdultSession,
  withStudyDay,
  memoryForTalk,
  dueCards,
  weakSkills,
  greetingFor,
  withAnswers
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
import Train from './screens/Train.jsx'
import TrainPlayer from './screens/TrainPlayer.jsx'
import { Toast } from './components/ui.jsx'
import { loadLearning, saveLearning, learnerKey } from './lib/learning.js'
import { todayKey } from './lib/state.js'
import { enqueueEnglishReward } from './lib/englishRewards.js'
import { currentUserId } from './lib/auth.js'
import { readRoute, routeIsAdult } from './lib/routes.js'
import { useAppHistory } from './hooks/useAppHistory.js'
import {
  exportLearningPayload,
  persistLearningPayload
} from './lib/cloudSave.js'
const CloudSettings = React.lazy(() => import('./screens/CloudSettings.jsx'))
const ToeicPractice = React.lazy(
  () => import('./screens/learning/ToeicPractice.jsx')
)
const Library = React.lazy(() => import('./screens/learning/Library.jsx'))
const LessonPlayer = React.lazy(
  () => import('./screens/learning/LessonPlayer.jsx')
)

// 子ども側の画面（ここでエラーになったら、子どものホームへもどす。大人側には PIN なしで入れない）
const KID_SCREENS = new Set([
  'setup',
  'home',
  'play',
  'guess',
  'result',
  'stickers',
  'friends',
  'parent',
  'who',
  'kidLibrary'
])

// 大人の1回の学習（きょうのメニュー、またはコース1つ）を何段階で進めるか
function stepsFor(kind, adult, plan) {
  if (kind === 'plan') return plan
  if (kind === 'chatStudy')
    return [
      {
        id: 'chat',
        course: 'chatStudy',
        minutes: ADULT_COURSES.chatStudy.chatMinutes
      },
      { id: 'study' }
    ]
  if (kind in ADULT_COURSES) return [{ id: 'chat', course: kind }]
  if (kind === 'toeic') return [{ id: 'toeic' }]
  if (kind === 'diagnosis') return [{ id: 'diagnosis' }]
  if (kind === 'review') return [{ id: 'review' }]
  if (kind === 'shadow') return [{ id: 'shadow' }]
  return []
}

export default function App() {
  const initialRoute = useMemo(() => readRoute(), [])
  const pendingRoute = useRef(null)
  const talkExit = useRef(null)
  const afterTalkRoute = useRef(null)
  const restoreRouteRef = useRef(null)
  const [learning, setLearning] = useState(() => loadLearning())
  const [libraryKind, setLibraryKind] = useState(initialRoute?.kind || null)
  const [selectedLesson, setSelectedLesson] = useState(
    initialRoute?.lesson || null
  )
  const updateLearning = useCallback(
    (fn) => setLearning((prev) => fn(prev)),
    []
  )
  useEffect(() => {
    if (!saveLearning(learning))
      showToast(
        '教材の記録を保存できませんでした。端末の空き容量を確認してください'
      )
  }, [learning])
  const [state, setState] = useState(() => loadState())
  const [adultStore, setAdultStore] = useState(() => loadAdultStore())
  // 大人がいれば、起動したら「だれが はなす？」から
  const [screen, setScreen] = useState(() => {
    const saved = loadState(),
      adults = loadAdultStore()
    if (initialRoute) {
      if (routeIsAdult(initialRoute)) {
        if (!adults.adults[adults.current]) return 'who'
        if (adults.pinRequired) {
          pendingRoute.current = initialRoute
          return 'adultPin'
        }
        return initialRoute.screen
      }
      if (initialRoute.screen === 'who' || initialRoute.screen === 'setup')
        return initialRoute.screen
      return saved.profile ? initialRoute.screen : 'who'
    }
    return saved.profile && !adults.order.length ? 'home' : 'who'
  })
  const [talkConfig, setTalkConfig] = useState(null)
  const [result, setResult] = useState(null)
  const [toast, setToast] = useState('')
  const [run, setRun] = useState(null) // 大人の学習の進み具合 { steps, index, results, startedAt }
  const [adultUnlocked, setAdultUnlocked] = useState(false)
  const [parentUnlocked, setParentUnlocked] = useState(false)
  useEffect(() => {
    if (!['parent', 'cloudSettingsKid'].includes(screen))
      setParentUnlocked(false)
  }, [screen])
  const [trainQueue, setTrainQueue] = useState(null) // 電車モード：続けて聞く番組 { ids, index }
  const toastTimer = useRef(null)

  const stateRef = useRef(state)
  stateRef.current = state
  useEffect(() => {
    if (!saveState(state))
      showToast('記録を保存できませんでした。端末の空き容量を確認してください')
  }, [state])
  useEffect(() => {
    if (!saveAdultStore(adultStore))
      showToast('端末の保存がいっぱいです。電車モードの番組を消してください')
  }, [adultStore])

  // ホームで相棒が話しかけてくる話題。起動ごとに選びなおす
  const [homeTopic, setHomeTopic] = useState(() =>
    pickTopic({ recentIds: loadState().recentTopics })
  )

  const update = useCallback((fn) => setState((prev) => fn(prev)), [])
  const updateAdultStore = useCallback(
    (fn) => setAdultStore((prev) => fn(prev)),
    []
  )
  const adult = adultStore.current
    ? adultStore.adults[adultStore.current]
    : null
  const adultId = adult?.id
  const updateAdult = useCallback(
    (fn) => setAdultStore((prev) => updateAdultIn(prev, prev.current, fn)),
    []
  )

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
          phrases: dueCards(current, Date.now() + 2 * 86400000, 6).map(
            (card) => card.en
          ),
          weakSkills: weakSkills(current).map((row) => row.ja)
        }
      })
      setScreen('talk')
      return
    }
    setScreen(
      step.id === 'study' || step.id === 'toeic' || step.id === 'diagnosis'
        ? 'quiz'
        : step.id
    )
  }

  const startAdult = useCallback((kind, plan) => {
    primePlayback()
    const steps = stepsFor(kind, adultRef.current, plan)
    if (!steps.length) return
    const fresh = {
      steps,
      index: 0,
      results: {},
      startedAt: new Date().toISOString()
    }
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
      results[key] = Array.isArray(value)
        ? [...(results[key] || []), ...value]
        : typeof value === 'number'
          ? (results[key] || 0) + value
          : value
    }
    const index = prev.index + 1
    const next = { ...prev, index, results }
    runRef.current = next
    setRun(next)
    if (Object.keys(stepResult).length)
      updateAdult((current) => withStudyDay(current))
    if (stop || index >= prev.steps.length)
      setScreen(Object.keys(results).length ? 'adultResult' : 'adultHome')
    else openStep(prev.steps, index, results)
  }, [])

  const finishTalk = useCallback(
    (session, { memoryAdded = [], cardsAdded = [], stopped = false } = {}) => {
      const childTurns = session.turns.filter((turn) => turn.who === 'child')
      if (session.mode === 'adult') {
        if (childTurns.length)
          updateAdult((current) => withAdultSession(current, session))
        const minutes = Math.max(
          0,
          (Date.now() - new Date(session.startedAt).getTime()) / 60000
        )
        const chat = childTurns.length
          ? {
              chatMinutes: minutes,
              sentences: childTurns.length,
              memoryAdded,
              cardsAdded,
              recasts: childTurns
                .filter((turn) => turn.recast || turn.tip)
                .map((turn) => ({
                  said: turn.text,
                  better: turn.recast,
                  tip: turn.tip || ''
                })),
              chatContext: session.turns
                .map(
                  (turn) =>
                    `${turn.who === 'partner' ? 'Alex' : 'Me'}: ${turn.text}`
                )
                .join('\n')
                .slice(-1200)
            }
          : {}
        finishStep(chat, { stop: stopped }) // ✕ でやめたら、学習はそこまで（「お勉強へ」なら次へ進む）
        if (afterTalkRoute.current) {
          const target = afterTalkRoute.current
          afterTalkRoute.current = null
          restoreRouteRef.current(target)
        }
        return
      }
      if (!childTurns.length) {
        setScreen('home')
        return
      }
      const outcome = withSessionEnd(stateRef.current, session)
      setState(
        outcome.completed
          ? enqueueEnglishReward(outcome.state, currentUserId())
          : outcome.state
      )
      setResult({
        record: outcome.record,
        completed: outcome.completed,
        memoryAdded
      })
      setHomeTopic(pickTopic({ recentIds: outcome.state.recentTopics }))
      if (afterTalkRoute.current) {
        const target = afterTalkRoute.current
        afterTalkRoute.current = null
        restoreRouteRef.current(target)
      } else setScreen('result')
    },
    []
  )

  const navigate = useCallback((id) => setScreen(id), [])
  const openLibrary = useCallback((audience, kind = null) => {
    setLibraryKind(kind)
    setScreen(audience === 'adult' ? 'adultLibrary' : 'kidLibrary')
  }, [])
  const openLesson = (id, audience) => {
    setSelectedLesson({ id, audience })
    setScreen('lesson')
  }
  const startGuidedTalk = (item) => {
    const current = adultRef.current
    const partner = ADULT_PARTNERS[current.partner] || ADULT_PARTNERS.alex
    const fresh = {
      steps: [{ id: 'chat', course: 'chat' }],
      index: 0,
      results: {},
      startedAt: new Date().toISOString()
    }
    runRef.current = fresh
    setRun(fresh)
    startTalk({
      mode: 'adult',
      partner: partner.id,
      adultPartner: partner,
      minutes: item.estimatedMinutes,
      guidedLessonId: item.id,
      adultScene: {
        id: item.id,
        emoji: item.emoji,
        title: item.title.ja,
        about: item.about,
        opener: 'Ready? You can start when you like.',
        openerJa: '準備はいいですか？好きなタイミングで始めてください。'
      },
      adultCtx: {
        name: current.name,
        memory: memoryForTalk(current),
        phrases: item.phrases.map((p) => p.en),
        weakSkills: []
      }
    })
  }
  const onLessonCompleted = (item) => {
    if (selectedLesson.audience === 'adult')
      updateAdult((current) => withStudyDay(current))
    else
      update((prev) =>
        enqueueEnglishReward(
          {
            ...prev,
            studyDays: [
              ...new Set([...(prev.studyDays || []), todayKey()])
            ].slice(-365)
          },
          currentUserId()
        )
      )
  }

  const chooseAdult = useCallback(
    (id) => {
      setAdultStore((prev) => ({ ...prev, current: id }))
      setScreen(
        adultStore.pinRequired && !adultUnlocked ? 'adultPin' : 'adultHome'
      )
    },
    [adultStore.pinRequired, adultUnlocked]
  )

  const restoreRoute = (route) => {
    const next = route || { screen: 'who' }
    if (routeIsAdult(next)) {
      if (!adult) {
        setScreen('who')
        return
      }
      if (adultStore.pinRequired && !adultUnlocked) {
        pendingRoute.current = next
        setScreen('adultPin')
        return
      }
    } else if (!['who', 'setup'].includes(next.screen) && !state.profile) {
      setScreen('who')
      return
    }
    setLibraryKind(next.kind || null)
    if (next.lesson) setSelectedLesson(next.lesson)
    setScreen(next.screen)
  }
  restoreRouteRef.current = restoreRoute
  useAppHistory({
    screen,
    selectedLesson,
    libraryKind,
    blocked: screen === 'adultPin',
    onRestore: (route) => {
      if (screen === 'talk' && talkExit.current) {
        afterTalkRoute.current = route
        talkExit.current()
        return
      }
      restoreRoute(route)
    }
  })
  const common = useMemo(
    () => ({ state, update, navigate, showToast }),
    [state, update, navigate, showToast]
  )
  const adultCommon = {
    adult,
    adultStore,
    updateAdult,
    updateAdultStore,
    navigate,
    showToast
  }
  const step = run?.steps[run.index]

  return (
    <div className="app" data-view={screen}>
      <ErrorBoundary
        key={screen}
        onReset={() => {
          setRun(null)
          setScreen(
            KID_SCREENS.has(screen) || !adult
              ? state.profile
                ? 'home'
                : 'who'
              : adultStore.pinRequired && !adultUnlocked
                ? 'who'
                : 'adultHome'
          )
        }}
      >
        {screen === 'setup' && (
          <Setup
            onBack={() => setScreen('who')}
            onDone={(profile) => {
              update((prev) => ({
                ...prev,
                profile: { ...profile, createdAt: new Date().toISOString() }
              }))
              setScreen('home')
            }}
          />
        )}
        {screen === 'home' && (
          <Home
            {...common}
            onLibrary={(kind) => openLibrary('kid', kind)}
            topic={homeTopic}
            onStart={startTalk}
          />
        )}
        {screen === 'play' && <PlayPicker {...common} onStart={startTalk} />}
        {screen === 'guess' && <GuessPicker {...common} onStart={startTalk} />}
        {screen === 'talk' && talkConfig && (
          <Talk
            key={talkConfig.key}
            {...common}
            config={talkConfig}
            onFinish={finishTalk}
            onExitReady={(fn) => {
              talkExit.current = fn
            }}
            onAdultCard={
              talkConfig.mode === 'adult' ? (fn) => updateAdult(fn) : null
            }
          />
        )}
        {screen === 'result' && result && (
          <Result {...common} result={result} />
        )}
        {screen === 'stickers' && <Stickers {...common} />}
        {screen === 'friends' && <Friends {...common} />}
        {screen === 'parent' && (
          <Parent
            {...common}
            initiallyUnlocked={parentUnlocked}
            onUnlocked={() => setParentUnlocked(true)}
            onStart={startTalk}
          />
        )}

        {screen === 'who' && (
          <Who
            state={state}
            adultStore={adultStore}
            updateAdultStore={updateAdultStore}
            onKid={() => setScreen(state.profile ? 'home' : 'setup')}
            onAdult={chooseAdult}
          />
        )}
        {screen === 'adultPin' && (
          <PinGate
            onUnlock={() => {
              setAdultUnlocked(true)
              const target = pendingRoute.current
              pendingRoute.current = null
              if (target) {
                setSelectedLesson(target.lesson || null)
                setLibraryKind(target.kind || null)
                setScreen(target.screen)
              } else setScreen('adultHome')
            }}
            onBack={() => setScreen('who')}
          />
        )}
        {screen === 'adultHome' && adult && (
          <AdultHome
            {...adultCommon}
            onLibrary={(kind) => openLibrary('adult', kind)}
            onStart={startAdult}
            onSwitch={() => {
              setAdultUnlocked(false)
              setScreen('who')
            }}
          />
        )}
        {screen === 'adultMemory' && adult && <AdultMemory {...adultCommon} />}
        {screen === 'toeicStats' && adult && (
          <Toeic
            {...adultCommon}
            onStart={startAdult}
            onPractice={() => setScreen('toeicPractice')}
          />
        )}
        {screen === 'train' && adult && (
          <Train
            {...adultCommon}
            onPlay={(ids) => {
              setTrainQueue({ ids, index: 0 })
              setScreen('trainPlayer')
            }}
          />
        )}
        {screen === 'trainPlayer' && adult && trainQueue && (
          <TrainPlayer
            {...adultCommon}
            queue={trainQueue}
            onNext={() =>
              setTrainQueue((prev) => ({ ...prev, index: prev.index + 1 }))
            }
            onExit={() => {
              setTrainQueue(null)
              setScreen('train')
            }}
          />
        )}
        {screen === 'review' && adult && (
          <Review
            key={`r${run?.startedAt}`}
            {...adultCommon}
            limit={step?.count}
            onDone={finishStep}
          />
        )}
        {screen === 'shadow' && adult && (
          <Shadow
            key={`s${run?.startedAt}`}
            {...adultCommon}
            onDone={finishStep}
          />
        )}
        {screen === 'quiz' && adult && step && (
          <Quiz
            key={`q${run.startedAt}${run.index}`}
            {...adultCommon}
            kind={step.id}
            recasts={run.results.recasts || []}
            context={run.results.chatContext || ''}
            onDone={finishStep}
          />
        )}
        {screen === 'adultResult' && adult && run && (
          <AdultResult
            key={run.startedAt}
            {...adultCommon}
            run={run}
            onHome={() => {
              setRun(null)
              setScreen('adultHome')
            }}
          />
        )}
      </ErrorBoundary>
      <ErrorBoundary
        key={`learning:${screen}`}
        onReset={() =>
          setScreen(adult ? 'adultHome' : state.profile ? 'home' : 'who')
        }
      >
        <React.Suspense
          fallback={
            <div className="screen">
              <div className="lesson-empty" role="status">
                教材を開いています…
              </div>
            </div>
          }
        >
          {(screen === 'kidLibrary' || screen === 'adultLibrary') && (
            <Library
              updateAdult={updateAdult}
              showToast={showToast}
              key={screen}
              adult={screen === 'adultLibrary' ? adult : null}
              learning={learning}
              learnerId={learnerKey(
                screen === 'adultLibrary'
                  ? { adult }
                  : { profile: state.profile }
              )}
              initialKind={libraryKind}
              onOpen={(id) =>
                openLesson(id, screen === 'adultLibrary' ? 'adult' : 'kid')
              }
              onBack={() =>
                setScreen(screen === 'adultLibrary' ? 'adultHome' : 'home')
              }
            />
          )}
          {screen === 'lesson' && selectedLesson && (
            <LessonPlayer
              key={`${selectedLesson.audience}:${selectedLesson.id}`}
              lessonId={selectedLesson.id}
              adult={selectedLesson.audience === 'adult' ? adult : null}
              learnerId={learnerKey(
                selectedLesson.audience === 'adult'
                  ? { adult }
                  : { profile: state.profile }
              )}
              learning={learning}
              updateLearning={updateLearning}
              updateAdult={updateAdult}
              showToast={showToast}
              onBack={() => openLibrary(selectedLesson.audience, libraryKind)}
              onCompleted={onLessonCompleted}
              onTalk={startGuidedTalk}
              onPlayEpisode={(id) => {
                setTrainQueue({ ids: [id], index: 0 })
                setScreen('trainPlayer')
              }}
            />
          )}
          {screen === 'cloudSettingsKid' && !parentUnlocked && (
            <PinGate
              onUnlock={() => setParentUnlocked(true)}
              onBack={() => setScreen('home')}
            />
          )}
          {((screen === 'cloudSettingsKid' && parentUnlocked) ||
            screen === 'cloudSettingsAdult') && (
            <CloudSettings
              state={state}
              adultStore={adultStore}
              learning={learning}
              update={update}
              showToast={showToast}
              onApply={({
                state: nextState,
                adultStore: nextAdult,
                learning: nextLearning
              }) => {
                persistLearningPayload(
                  exportLearningPayload({
                    state: nextState,
                    adultStore: nextAdult,
                    learning: nextLearning
                  })
                )
                setState(nextState)
                setAdultStore(nextAdult)
                setLearning(nextLearning)
                setAdultUnlocked(false)
                setParentUnlocked(false)
                setScreen('who')
              }}
              onBack={() =>
                setScreen(
                  screen === 'cloudSettingsKid' ? 'parent' : 'adultHome'
                )
              }
            />
          )}
          {screen === 'toeicPractice' && adult && (
            <ToeicPractice
              learning={learning}
              learnerId={learnerKey({ adult })}
              updateLearning={updateLearning}
              onBack={() => setScreen('toeicStats')}
              onComplete={(run) => {
                import('./content/toeic.js').then(({ toeicQuestion }) => {
                  const answers = Object.entries(run.answers).map(
                    ([id, entry]) => {
                      const q = toeicQuestion(id)
                      return {
                        part: q.part,
                        skill: q.skill,
                        correct: entry.choice === q.answerIndex,
                        questionId: id,
                        version: q.version,
                        elapsedMs: entry.elapsedMs,
                        hintUsed: run.hints.includes(id)
                      }
                    }
                  )
                  if (answers.length)
                    updateAdult((current) =>
                      withStudyDay(withAnswers(current, answers))
                    )
                })
              }}
            />
          )}
        </React.Suspense>
      </ErrorBoundary>
      <Toast message={toast} />
    </div>
  )
}
