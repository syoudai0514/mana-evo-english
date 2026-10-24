// 電車モードの再生画面。いまの文が光る。字幕・速さ・前後の文・カードに追加・章・おやすみタイマー。
// <audio> で鳴らすので、画面を消しても（ロック中も）鳴りつづけ、ロック画面から操作できる。
// 長い番組は章ごとの音声を順番に鳴らす（時間・字幕は番組全体の時間で扱う）。
// TOEIC は「答える」なら問題文で止まり、タップで答えてから続き。「聞き流し」なら止まらず、考える間のあと答えと解説が流れる。
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { PROGRAMS } from '../data/programs.js'
import { TRAIN_KINDS } from '../data/train.js'
import { getEpisode, getPart, saveProgress } from '../lib/episodeStore.js'
import { withAnswers, withCards, withGrade, withStudyDay } from '../lib/adult.js'
import { setPlaybackSession } from '../lib/recorder.js'
import { trainAudio } from '../lib/trainAudio.js'
import { AdultTop } from '../components/adultUi.jsx'

const RATES = [0.8, 1, 1.2]
const SUBS = [['both', '英＋日'], ['en', '英だけ'], ['none', 'なし']]
const LETTERS = ['A', 'B', 'C', 'D']
const SLEEP = [[0, 'タイマーなし'], [15, '15分で停止'], [30, '30分で停止'], [45, '45分で停止'], ['chapter', 'この章で停止']]

function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function readSetting(key, fallback) {
  try { return localStorage.getItem(key) || fallback } catch { return fallback }
}
function writeSetting(key, value) {
  try { localStorage.setItem(key, String(value)) } catch {}
}

// いま流れている行（start が time 以下で最後のもの）
export function lineAt(lines, time) {
  let index = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].start <= time + 0.05) index = i
    else break
  }
  return index
}

// 番組全体の時間 → 何章めの何秒か
export function partAt(chapters, time) {
  let part = 0
  for (let i = 0; i < chapters.length; i += 1) if (chapters[i].start <= time + 0.01) part = i
  return { part, local: Math.max(0, time - (chapters[part]?.start || 0)) }
}

// 古い番組（1本の音声）は、全体を1つの章として扱う
function chaptersOf(episode) {
  return episode.chapters?.length ? episode.chapters : [{ title: episode.title, start: 0, duration: episode.duration }]
}

export default function TrainPlayer({ adult, updateAdult, queue, onNext, onExit, showToast }) {
  const [episode, setEpisode] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [part, setPart] = useState(0)
  const [rate, setRate] = useState(() => Number(readSetting('mee-train-rate', 1)) || 1)
  const [subs, setSubs] = useState(() => readSetting('mee-train-subs', 'both'))
  const [toeicMode, setToeicMode] = useState(() => readSetting('mee-train-toeic', 'answer')) // answer 答える / listen 聞き流し
  const [sleep, setSleep] = useState({ kind: 0, at: 0 }) // おやすみタイマー
  const [showChapters, setShowChapters] = useState(false)
  const [asking, setAsking] = useState(null) // TOEIC：いま答えている問題の番号
  const [answers, setAnswers] = useState({}) // 問題の番号 → 選んだ番号
  const audio = useRef(trainAudio()) // 番組を選んだタップで鳴らせるようにした <audio>（iPhone）
  const listRef = useRef(null)
  const savedAt = useRef(0)
  const partRef = useRef(0)
  const urlRef = useRef('')
  const loading = useRef(0)
  const id = queue.ids[queue.index]

  // 章の音声を読みこんで、その章の at 秒から鳴らす
  const loadPart = async (loaded, index, at, play) => {
    const ticket = ++loading.current
    const blob = await getPart(loaded, index).catch(() => null)
    if (ticket !== loading.current) return false
    if (!blob) { showToast?.('この章の音声がありません'); return false }
    const element = audio.current
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = URL.createObjectURL(blob)
    partRef.current = index
    setPart(index)
    element.src = urlRef.current
    element.playbackRate = rate
    // 読みこみが終わってから位置を合わせる（先に合わせると iPhone では 0 にもどる）
    if (at > 0.2) element.addEventListener('loadedmetadata', () => { element.currentTime = at }, { once: true })
    setPlaybackSession() // 音楽と同じモード（マナーモードでも鳴る）
    if (play) element.play().catch(() => { setPlaying(false); showToast?.('▶ を押すと はじまります') })
    return true
  }

  useEffect(() => {
    let alive = true
    setEpisode(null)
    setAnswers({})
    setAsking(null)
    setTime(0)
    getEpisode(id).then((loaded) => {
      if (!alive) return
      // 消えていた番組・まだ1章もできていない番組は飛ばす
      if (!loaded || !(loaded.audio || loaded.chapters?.length)) {
        showToast?.('番組が見つかりませんでした')
        if (queue.index + 1 < queue.ids.length) onNext(); else onExit()
        return
      }
      setEpisode(loaded)
      // 途中から再開するときは、もう答えた問題を聞きなおさない
      if (!loaded.listened && loaded.answers) setAnswers(loaded.answers)
      const startAt = loaded.listened ? 0 : Math.min(loaded.position || 0, Math.max(0, loaded.duration - 1))
      const { part: startPart, local } = partAt(chaptersOf(loaded), startAt)
      setTime(startAt)
      loadPart(loaded, startPart, local, true)
    }).catch(() => { if (alive) { showToast?.('番組を読みこめませんでした'); onExit() } })
    return () => {
      alive = false
      loading.current += 1
      const element = audio.current
      element.pause()
      if (urlRef.current) { element.removeAttribute('src'); element.load(); URL.revokeObjectURL(urlRef.current); urlRef.current = '' }
    }
  }, [id])

  // <audio> の出来事を、いまの画面の状態で受けとる（使いまわす <audio> なので、ここでつなぐ）
  const events = useRef({})
  useEffect(() => {
    const element = audio.current
    const on = {
      timeupdate: () => events.current.onTime?.(),
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      ended: () => events.current.onEnded?.(),
      // 読みこみや再生のエラー（番組が こわれている など）
      error: () => { if (element.getAttribute('src')?.startsWith('blob:')) { setPlaying(false); showToast?.('再生できませんでした。番組を作りなおしてください') } }
    }
    for (const [name, handler] of Object.entries(on)) element.addEventListener(name, handler)
    return () => { for (const [name, handler] of Object.entries(on)) element.removeEventListener(name, handler) }
  }, [])

  const chapters = episode ? chaptersOf(episode) : []
  const lines = episode?.lines || []
  const index = lineAt(lines, time)
  const line = lines[index]
  const programId = episode?.programId || episode?.kind
  const kind = PROGRAMS[programId] || TRAIN_KINDS[episode?.kind] || TRAIN_KINDS.chat
  const toeic = programId === 'toeic'
  const making = episode?.status === 'making'
  const planned = episode?.plan?.chapters?.length || chapters.length

  // ロック画面の表示と操作（ボタンは、いまの位置・問題の状態を見る。登録したときの古い値は使わない）
  const actions = useRef({})
  actions.current = { jump: (step) => jump(step), replay: () => replayLine(), play: () => { if (asking === null) audio.current?.play().catch(() => {}) } }
  useEffect(() => {
    if (!episode || !('mediaSession' in navigator)) return undefined
    const set = (action, handler) => { try { navigator.mediaSession.setActionHandler(action, handler) } catch {} }
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({ title: episode.title, artist: kind.title, album: 'マナエボ英語 電車モード' })
    } catch {}
    set('play', () => actions.current.play())
    set('pause', () => audio.current?.pause())
    set('previoustrack', () => actions.current.jump(-1))
    set('nexttrack', () => actions.current.jump(1))
    set('seekbackward', () => actions.current.replay())
    return () => {
      for (const action of ['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward']) set(action, null)
      try { navigator.mediaSession.metadata = null } catch {}
    }
  }, [episode])

  const save = (position, extra = {}) => {
    if (!episode) return
    savedAt.current = Date.now()
    saveProgress(episode.id, { position, ...extra })
  }

  const onTime = () => {
    if (!episode) return
    const element = audio.current
    const now = (chapters[partRef.current]?.start || 0) + element.currentTime
    setTime(now)
    if (Date.now() - savedAt.current > 10000) save(now)
    // おやすみタイマー
    if (sleep.at && Date.now() >= sleep.at) { element.pause(); setSleep({ kind: 0, at: 0 }); showToast?.('タイマーで止めました') }
    // TOEIC（答える）：問題文まで来たら止めて答えてもらう
    if (toeic && toeicMode === 'answer' && asking === null) {
      const set = (episode.sets || []).findIndex((item, i) => item.end && answers[i] === undefined && now >= item.end - 0.05 && now < item.end + 4)
      if (set >= 0) { element.pause(); setAsking(set) }
    }
  }

  const onEnded = () => {
    const next = partRef.current + 1
    // 「この章で停止」
    if (sleep.kind === 'chapter') { setSleep({ kind: 0, at: 0 }); save(chapters[next]?.start || episode.duration); showToast?.('章のおわりで止めました'); return }
    if (next < chapters.length) { loadPart(episode, next, 0, true); return }
    if (making) { save(episode.duration); showToast?.('ここまでできています。続きは作っているところです'); return }
    setPlaying(false)
    save(0, { listened: true, answers: null })
    updateAdult((current) => withStudyDay(current))
    if (queue.index + 1 < queue.ids.length) onNext()
  }

  events.current = { onTime: () => onTime(), onEnded: () => onEnded() }

  const toggle = () => {
    const element = audio.current
    if (asking !== null) return
    if (element.paused) element.play().catch(() => {})
    else { element.pause(); save(time) }
  }

  // 番組全体の秒で動かす（別の章なら、その章を読みこむ）
  const seekTo = (seconds) => {
    if (!episode) return
    const target = Math.max(0, Math.min(seconds, episode.duration - 0.2))
    const { part: targetPart, local } = partAt(chapters, target)
    setTime(target)
    if (targetPart !== partRef.current) { loadPart(episode, targetPart, local, asking === null); return }
    const element = audio.current
    element.currentTime = local
    if (element.paused && asking === null) element.play().catch(() => {})
  }

  function jump(step) {
    if (!lines.length) return
    const target = Math.min(lines.length - 1, Math.max(0, (index < 0 ? 0 : index) + step))
    seekTo(lines[target].start - 0.05)
  }

  function replayLine() {
    if (line) seekTo(line.start - 0.05)
  }

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length]
    setRate(next)
    audio.current.playbackRate = next
    writeSetting('mee-train-rate', next)
  }

  const cycleSleep = () => {
    const current = SLEEP.findIndex(([value]) => value === sleep.kind)
    const [value, label] = SLEEP[(current + 1) % SLEEP.length]
    setSleep({ kind: value, at: typeof value === 'number' && value ? Date.now() + value * 60000 : 0 })
    showToast?.(label)
  }

  const chooseSubs = (value) => {
    setSubs(value)
    writeSetting('mee-train-subs', value)
  }

  const chooseToeicMode = (value) => {
    setToeicMode(value)
    writeSetting('mee-train-toeic', value)
    if (value === 'listen' && asking !== null) resume()
  }

  const bookmark = () => {
    if (!line?.en) return
    updateAdult((current) => withCards(current, [{ en: line.en, ja: line.ja || line.en }], '電車モード'))
    showToast('復習カードに入れました')
  }

  const weakCard = () => {
    if (!line?.cardId) return
    updateAdult((current) => withGrade(current, line.cardId, 'again'))
    showToast('にがてにしました（すぐまた出ます）')
  }

  const answer = (choice) => {
    const set = episode.sets[asking]
    setAnswers((prev) => {
      const next = { ...prev, [asking]: choice }
      if (episode) saveProgress(episode.id, { answers: next })
      return next
    })
    updateAdult((current) => withAnswers(current, [{ part: set.part, skill: set.part === 'p4' ? 'talk' : 'detail', correct: choice === set.answer }]))
  }

  function resume() {
    setAsking(null)
    audio.current.play().catch(() => {})
  }

  // いまの文を見える位置に
  useEffect(() => {
    listRef.current?.querySelector('.tl.now')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [index])

  // ことばのコツ：いまの文に出てくる言い方
  const tip = useMemo(() => (episode?.tips || []).find((item) => line?.en && line.en.toLowerCase().includes(String(item.en).toLowerCase().replace(/[.!?]$/, ''))), [episode, index])

  // 答えるまでは字幕なし（本番と同じ）。聞き流しなら、答えの行が流れたら出す
  const hidden = (item) => toeic && item.set !== undefined && answers[item.set] === undefined && !(toeicMode === 'listen' && time >= (episode.sets?.[item.set]?.end || Infinity) + 4)
  const set = asking !== null ? episode.sets[asking] : null
  const chosen = asking !== null ? answers[asking] : undefined
  const sleepLabel = SLEEP.find(([value]) => value === sleep.kind)?.[1]

  return (
    <div className="screen adult-dark train-player">
      <AdultTop onBack={() => { save(time); onExit() }} title={<>{kind.emoji} <span style={{ maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'bottom' }}>{episode?.title || '読みこみ中…'}</span>{queue.ids.length > 1 && <span className="muted" style={{ marginLeft: 4, fontSize: 11 }}>{queue.index + 1}/{queue.ids.length}</span>}</>}
        right={episode?.kind === 'cards'
          ? <button className="icon-btn" aria-label="にがて" onClick={weakCard}>😵</button>
          : <button className="icon-btn" aria-label="カードに" onClick={bookmark}>🔖</button>} />

      {episode && (chapters.length > 1 || making) && (
        <div className="chapter-bar">
          <button className="chip" onClick={() => setShowChapters((open) => !open)}>📑 第{part + 1}章 / {planned}章 ▾</button>
          <span className="muted s chapter-name">{chapters[part]?.title}</span>
        </div>
      )}
      {making && <div className="muted s" style={{ padding: '0 18px 6px', color: '#FFD86B' }}>第{chapters.length}章まで聞けます（のこりは作成中・または止まっています）</div>}
      {toeic && (
        <div className="seg2" style={{ margin: '0 16px 6px' }}>
          <button className={toeicMode === 'answer' ? 'on' : ''} onClick={() => chooseToeicMode('answer')}>✋ 答える</button>
          <button className={toeicMode === 'listen' ? 'on' : ''} onClick={() => chooseToeicMode('listen')}>🎧 聞き流し</button>
        </div>
      )}

      {showChapters ? (
        <div className="scroll train-lines">
          {chapters.map((chapter, i) => (
            <button key={i} className={`chap-row ${i === part ? 'now' : i < part ? 'done' : ''}`} onClick={() => { setShowChapters(false); seekTo(chapter.start + 0.01) }}>
              <span className="n">{i + 1}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{chapter.title}</span>
              <span className="muted s">{clock(chapter.duration)}</span>
            </button>
          ))}
          {episode?.plan?.chapters?.slice(chapters.length).map((chapter, i) => (
            <div key={`p${i}`} className="chap-row todo"><span className="n">{chapters.length + i + 1}</span><span style={{ flex: 1 }}>{chapter.title}</span><span className="muted s">未作成</span></div>
          ))}
        </div>
      ) : (
        <div className="scroll train-lines" ref={listRef}>
          {lines.map((item, i) => (
            <button key={i} className={`tl ${i === index ? 'now' : ''}`} onClick={() => seekTo(item.start - 0.05)}>
              {item.speaker !== 'JA' && <span className="spk">{item.speaker === 'N' ? 'Narrator' : item.speaker === 'M' ? 'Man' : item.speaker === 'W' ? 'Woman' : item.speaker}{item.repeat ? '（もう一度）' : ''}</span>}
              {hidden(item)
                ? <span className="muted">🎧 …（答えたあとに字幕が出ます）</span>
                : item.speaker === 'JA'
                  ? <span className="jp-prompt">🇯🇵 {item.ja}</span>
                  : <>
                      {subs !== 'none' && <span className="en-line">{item.en}</span>}
                      {subs === 'both' && item.ja && !item.question && <span className="jp">{item.ja}</span>}
                      {subs === 'none' && <span className="muted">🎧</span>}
                    </>}
            </button>
          ))}
        </div>
      )}

      {tip && subs !== 'none' && !showChapters && <div className="tip2 train-tip">💡 <b>{tip.en}</b> ＝ {tip.ja}</div>}

      {set && (
        <div className="a-card train-q">
          <div className="t en">{set.question_en}</div>
          <div className="choices">
            {set.choices.map((choice, i) => {
              const state = chosen === undefined ? '' : i === set.answer ? 'right' : i === chosen ? 'wrong' : ''
              return <button key={i} type="button" className={`qopt ${state}`} onClick={() => chosen === undefined && answer(i)}><b>{LETTERS[i]}</b><span>{choice}</span></button>
            })}
          </div>
          {chosen !== undefined && <>
            <div className="explain">{chosen === set.answer ? '⭕ 正解！ ' : '❌ '}{set.explain_ja}</div>
            <button className="press cta" style={{ height: 48, fontSize: 16, marginTop: 10 }} onClick={resume}>つぎへ ▶</button>
          </>}
        </div>
      )}

      <div className="train-dock">
        <div className="prog"><i style={{ width: `${episode ? Math.min(100, (time / Math.max(1, episode.duration)) * 100) : 0}%` }} /></div>
        <div className="muted s" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span>{clock(time)}</span><span>{clock(episode?.duration)}</span></div>
        <div className="ctrl">
          <button className="b" aria-label="前の文" onClick={() => jump(-1)}>⏮</button>
          <button className="b" aria-label="今の文をもう一度" onClick={replayLine}>↺</button>
          <button className="p" aria-label={playing ? '一時停止' : '再生'} onClick={toggle}>{playing ? '❚❚' : '▶'}</button>
          <button className="b rate" aria-label="速さ" onClick={cycleRate}>{rate.toFixed(1)}×</button>
          <button className="b" aria-label="次の文" onClick={() => jump(1)}>⏭</button>
        </div>
        <div className="seg2">
          {SUBS.map(([value, label]) => <button key={value} className={subs === value ? 'on' : ''} onClick={() => chooseSubs(value)}>{label}</button>)}
          <button className={sleep.kind ? 'on' : ''} aria-label="おやすみタイマー" onClick={cycleSleep}>⏲ {sleep.kind ? sleepLabel.replace('で停止', '') : 'タイマー'}</button>
        </div>
      </div>
    </div>
  )
}
