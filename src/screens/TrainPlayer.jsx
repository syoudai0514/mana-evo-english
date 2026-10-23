// 電車モードの再生画面。いまの文が光る。字幕・速さ・前後の文・カードに追加。
// <audio> で鳴らすので、画面を消しても（ロック中も）鳴りつづけ、ロック画面から操作できる。
// TOEIC は問題文のところで止まり、タップで答えてから続きへ。
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { TRAIN_KINDS } from '../data/train.js'
import { getEpisode, saveProgress } from '../lib/episodeStore.js'
import { withAnswers, withCards, withGrade, withStudyDay } from '../lib/adult.js'
import { setPlaybackSession } from '../lib/recorder.js'
import { trainAudio } from '../lib/trainAudio.js'
import { AdultTop } from '../components/adultUi.jsx'

const RATES = [0.8, 1, 1.2]
const SUBS = [['both', '英＋日'], ['en', '英だけ'], ['none', 'なし']]
const LETTERS = ['A', 'B', 'C', 'D']

function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
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

export default function TrainPlayer({ adult, updateAdult, queue, onNext, onExit, showToast }) {
  const [episode, setEpisode] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [rate, setRate] = useState(() => { try { return Number(localStorage.getItem('mee-train-rate')) || 1 } catch { return 1 } })
  const [subs, setSubs] = useState(() => { try { return localStorage.getItem('mee-train-subs') || 'both' } catch { return 'both' } })
  const [asking, setAsking] = useState(null) // TOEIC：いま答えている問題の番号
  const [answers, setAnswers] = useState({}) // 問題の番号 → 選んだ番号
  const audio = useRef(trainAudio()) // 番組を選んだタップで鳴らせるようにした <audio>（iPhone）
  const listRef = useRef(null)
  const savedAt = useRef(0)
  const id = queue.ids[queue.index]

  useEffect(() => {
    let url = ''
    let alive = true
    setEpisode(null)
    setAnswers({})
    setAsking(null)
    getEpisode(id).then((loaded) => {
      if (!alive) return
      // 消えていた番組（新しい番組で入れかわった）は飛ばす
      if (!loaded?.audio) { showToast?.('番組が見つかりませんでした'); if (queue.index + 1 < queue.ids.length) onNext(); else onExit(); return }
      setEpisode(loaded)
      // 途中から再開するときは、もう答えた問題を聞きなおさない
      if (!loaded.listened && loaded.answers) setAnswers(loaded.answers)
      url = URL.createObjectURL(loaded.audio)
      const element = audio.current
      element.src = url
      element.playbackRate = rate
      const startAt = loaded.listened ? 0 : loaded.position || 0
      // 読みこみが終わってから位置を合わせる（先に合わせると iPhone では 0 にもどる）
      if (startAt) element.addEventListener('loadedmetadata', () => { element.currentTime = startAt }, { once: true })
      setPlaybackSession() // 音楽と同じモード（マナーモードでも鳴る）
      element.play().catch(() => { setPlaying(false); showToast?.('▶ を押すと はじまります') })
    }).catch(() => { if (alive) { showToast?.('番組を読みこめませんでした'); onExit() } })
    return () => {
      alive = false
      const element = audio.current
      element.pause()
      if (url) { element.removeAttribute('src'); element.load(); URL.revokeObjectURL(url) }
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

  const lines = episode?.lines || []
  const index = lineAt(lines, time)
  const line = lines[index]
  const kind = TRAIN_KINDS[episode?.kind] || TRAIN_KINDS.chat
  const toeic = episode?.kind === 'toeic'

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
    const element = audio.current
    const now = element.currentTime
    setTime(now)
    if (Date.now() - savedAt.current > 10000) save(now)
    // TOEIC：問題文まで来たら止めて答えてもらう
    if (toeic && asking === null) {
      const set = (episode.sets || []).findIndex((item, i) => item.end && answers[i] === undefined && now >= item.end - 0.05)
      if (set >= 0) { element.pause(); setAsking(set) }
    }
  }

  events.current = { onTime: () => onTime(), onEnded: () => onEnded() }

  const onEnded = () => {
    setPlaying(false)
    save(0, { listened: true, answers: null })
    updateAdult((current) => withStudyDay(current))
    if (queue.index + 1 < queue.ids.length) onNext()
  }

  const toggle = () => {
    const element = audio.current
    if (asking !== null) return
    if (element.paused) element.play().catch(() => {})
    else { element.pause(); save(element.currentTime) }
  }

  const seekTo = (seconds) => {
    const element = audio.current
    if (!element) return
    element.currentTime = Math.max(0, seconds)
    setTime(element.currentTime)
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
    try { localStorage.setItem('mee-train-rate', String(next)) } catch {}
  }

  const chooseSubs = (value) => {
    setSubs(value)
    try { localStorage.setItem('mee-train-subs', value) } catch {}
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

  const resume = () => {
    setAsking(null)
    audio.current.play().catch(() => {})
  }

  // いまの文を見える位置に
  useEffect(() => {
    listRef.current?.querySelector('.tl.now')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [index])

  // ことばのコツ：いまの文に出てくる言い方
  const tip = useMemo(() => (episode?.tips || []).find((item) => line?.en && line.en.toLowerCase().includes(String(item.en).toLowerCase().replace(/[.!?]$/, ''))), [episode, index])

  const hidden = (item) => toeic && answers[item.set] === undefined // 答えるまでは字幕なし（本番と同じ）
  const set = asking !== null ? episode.sets[asking] : null
  const chosen = asking !== null ? answers[asking] : undefined

  return (
    <div className="screen adult-dark train-player">
      <AdultTop onBack={() => { save(audio.current?.currentTime || 0); onExit() }} title={<>{kind.emoji} <span style={{ maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'bottom' }}>{episode?.title || '読みこみ中…'}</span>{queue.ids.length > 1 && <span className="muted" style={{ marginLeft: 4, fontSize: 11 }}>{queue.index + 1}/{queue.ids.length}</span>}</>}
        right={episode?.kind === 'cards'
          ? <button className="icon-btn" aria-label="にがて" onClick={weakCard}>😵</button>
          : <button className="icon-btn" aria-label="カードに" onClick={bookmark}>🔖</button>} />

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

      {tip && subs !== 'none' && <div className="tip2 train-tip">💡 <b>{tip.en}</b> ＝ {tip.ja}</div>}

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
        {episode?.mock&&<p role="status" className="content-note">画面確認用の音です。英語の読み上げ音声ではありません。</p>}<div className="prog"><i style={{ width: `${episode ? Math.min(100, (time / episode.duration) * 100) : 0}%` }} /></div>
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
        </div>
      </div>
    </div>
  )
}

