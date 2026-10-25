// 電車モード（大人だけ）：話さずに聞く・見る番組。家の Wi-Fi で番組表からまとめて作って保存し、電車では聞くだけ。
// ホーム（つづき・保存したリスト・新着）／番組表（えらんで長さを決めてダウンロード）／ライブラリ（えらんだ順に連続再生）
import React, { useEffect, useRef, useState } from 'react'
import { PROGRAMS, estimate } from '../data/programs.js'
import { TRAIN_KINDS } from '../data/train.js'
import { deleteEpisode, listEpisodes, storageInfo } from '../lib/episodeStore.js'
import { dismissJob, enqueueProgram, resumeProgram, subscribeJobs } from '../lib/trainJobs.js'
import { recentTranscript } from '../lib/episodes.js'
import { primePlayback } from '../lib/audio.js'
import { unlockTrainAudio } from '../lib/trainAudio.js'
import { AdultTop } from '../components/adultUi.jsx'
import { isMockMode } from '../lib/config.js'
import { cancelProgram, downloadProgram, downloadedServerIds, requestProgram, retryProgram, serverStatus } from '../lib/trainServer.js'

// 頼んだ・やり直した・やめたあと、すぐサーバーの様子を見なおす
const CHECK_EVENT = 'mee-train-check'
const checkServer = () => window.dispatchEvent(new Event(CHECK_EVENT))

const ERRORS = {
  'no-chat': 'まだ Alex との雑談がありません（3往復以上話すと作れます）',
  'no-cards': '復習カードがまだありません（雑談すると増えます）',
  script: '台本がうまく作れませんでした',
  voice: '声の準備がうまくいきませんでした',
  auth: 'ログインが切れています（保護者画面からログイン）',
  gone: '番組が見つかりませんでした',
  failed: 'うまく作れませんでした'
}
const STAGES = { queued: 'じゅんばん待ち', plan: '番組の計画', script: '台本づくり', voice: '声の準備', encode: '保存の準備', ready: 'ダウンロード中', done: 'できあがり！' }

// サーバーで作る（アプリを閉じても作りつづける）。確認用の mock のときは、この iPhone で作る
const onServer = () => !isMockMode()

// サーバーの番組づくりの様子を、この画面の形に
function fromServer(job) {
  const progress = job.progress || {}
  return {
    id: job.id,
    server: true,
    programId: job.program_id,
    title: progress.title || PROGRAMS[job.program_id]?.title || '番組',
    stage: job.status === 'ready' ? 'ready' : job.status === 'queued' && !progress.stage ? 'queued' : progress.stage || 'queued',
    chapter: progress.chapter || 0,
    chapters: progress.chapters || 0,
    done: progress.done || 0,
    total: progress.total || 0,
    error: job.status === 'failed' ? job.error || 'failed' : null
  }
}

function minutes(seconds) {
  return `${Math.max(1, Math.round((seconds || 0) / 60))}分`
}

function programOf(episode) {
  return PROGRAMS[episode.programId || episode.kind] || TRAIN_KINDS[episode.kind] || PROGRAMS.talk
}

// 保存したリスト（例：行き・帰り）。この端末の、この人のぶんだけ
function listsKey(adultId) {
  return `mee-train-lists:${adultId}`
}
function loadLists(adultId) {
  try { return JSON.parse(localStorage.getItem(listsKey(adultId)) || '[]') } catch { return [] }
}
function saveLists(adultId, lists) {
  try { localStorage.setItem(listsKey(adultId), JSON.stringify(lists)) } catch {}
}

export default function Train({ adult, navigate, onPlay, showToast }) {
  const [view, setView] = useState('home') // home / catalog / library
  const [episodes, setEpisodes] = useState(null)
  const [jobs, setJobs] = useState([])
  const [storage, setStorage] = useState(null)
  const [lists, setLists] = useState(() => loadLists(adult.id))
  const [remote, setRemote] = useState({ jobs: [], catalog: [] }) // サーバーで作っている番組・毎晩の作り置き
  const [have, setHave] = useState(new Set()) // もう受けとった作り置き
  const fetching = useRef(new Set())

  const reload = () => {
    listEpisodes(adult.id).then(setEpisodes).catch(() => setEpisodes([]))
    storageInfo().then(setStorage)
  }
  useEffect(() => { reload() }, [adult.id])

  // サーバーの様子を見る。作っている番組があるときだけ15秒ごと（ないときは開いたときだけ。サーバーの無料枠を使いすぎないように）
  // できた番組は自動でダウンロード
  useEffect(() => {
    if (!onServer()) return undefined
    let alive = true
    let timer = null
    const check = async () => {
      clearTimeout(timer)
      if (document.hidden) return
      let busy = false
      try {
        const status = await serverStatus(adult)
        if (!alive) return
        setRemote(status)
        setHave(await downloadedServerIds(adult))
        for (const job of status.jobs.filter((item) => item.status === 'ready' && !fetching.current.has(item.id))) {
          fetching.current.add(job.id)
          downloadProgram(adult, job.id)
            .then(() => { if (alive) { showToast('番組ができました！'); reload() } })
            .catch(() => fetching.current.delete(job.id))
        }
        busy = status.jobs.some((job) => job.status === 'queued' || job.status === 'working')
      } catch {}
      if (alive && busy) timer = setTimeout(check, 15000)
    }
    const onVisible = () => { if (!document.hidden) check() }
    check()
    window.addEventListener(CHECK_EVENT, check)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      clearTimeout(timer)
      window.removeEventListener(CHECK_EVENT, check)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [adult.id])

  const downloadShared = async (items) => {
    for (const item of items) {
      if (fetching.current.has(item.id)) continue
      fetching.current.add(item.id)
      try { await downloadProgram(adult, item.id) } catch { showToast('ダウンロードできませんでした。電波のいい所でもう一度') }
      fetching.current.delete(item.id)
    }
    setHave(await downloadedServerIds(adult))
    reload()
  }
  // 章ができた・番組ができたら一覧を読みなおす（進み具合のたびには読まない）
  const progressKey = useRef('')
  useEffect(() => subscribeJobs((next) => {
    const mine = next.filter((job) => job.adultId === adult.id)
    setJobs(mine)
    const key = mine.map((job) => `${job.id}:${job.chapter}:${job.stage === 'done'}:${Boolean(job.error)}:${job.episodeId || ''}`).join('|')
    if (key !== progressKey.current) { progressKey.current = key; reload() }
  }), [adult.id])

  const play = (ids) => {
    const playable = ids.filter((id) => episodes?.some((episode) => episode.id === id && (episode.audio || episode.chapters?.length)))
    if (!playable.length) return showToast('まだ聞ける番組がありません')
    primePlayback()
    unlockTrainAudio() // タップの中で <audio> を鳴らせるようにしておく（iPhone）
    onPlay(playable)
  }

  const saveList = (name, ids) => {
    const next = [...lists, { id: `l${Date.now().toString(36)}`, name, ids }]
    setLists(next)
    saveLists(adult.id, next)
    showToast(`「${name}」を保存しました`)
  }
  const removeList = (id) => {
    const next = lists.filter((list) => list.id !== id)
    setLists(next)
    saveLists(adult.id, next)
  }

  const allJobs = [...jobs, ...remote.jobs.map(fromServer)]
  const common = { adult, episodes: episodes || [], jobs: allJobs, play, showToast, reload, storage }
  if (view === 'catalog') return <Catalog {...common} onBack={() => setView('home')} onDone={() => setView('library')} />
  if (view === 'library') return <Library {...common} onBack={() => setView('home')} onSaveList={saveList} onCatalog={() => setView('catalog')} />

  const all = episodes || []
  const resumeItem = all.find((episode) => !episode.listened && episode.position > 0 && (episode.audio || episode.chapters?.length))
  const fresh = all.filter((episode) => !episode.listened && episode !== resumeItem && (episode.audio || episode.chapters?.length)).slice(0, 3)
  const byId = Object.fromEntries(all.map((episode) => [episode.id, episode]))
  const totalMb = storage?.usedMb

  return (
    <div className="screen adult-dark">
      <AdultTop onBack={() => navigate('adultHome')} title="🚃 電車モード" right={<span className="pill" style={{ fontSize: 12 }}>📦 {all.length}本{totalMb ? `・${totalMb}MB` : ''}</span>} />
      <div className="scroll">
        <div className="a-section">
          <div className="muted s">話さなくてOK。聞いて・見て覚える番組。家の Wi-Fi で作っておけば、電車では通信なしで聞けます。</div>

          {allJobs.length > 0 && <JobList jobs={allJobs} adult={adult} episodes={all} compact />}

          {onServer() && remote.catalog.some((item) => !have.has(item.id)) && (
            <>
              <div className="a-label">🌙 とどいた番組（みんなの作り置き）</div>
              {remote.catalog.filter((item) => !have.has(item.id)).slice(0, 6).map((item) => (
                <div key={item.id} className="a-card row" style={{ gap: 10 }}>
                  <div className="ep-ic" style={{ background: PROGRAMS[item.program_id]?.bg }}>{PROGRAMS[item.program_id]?.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t ellipsis">{item.title || PROGRAMS[item.program_id]?.title}</div>
                    <div className="muted s">{minutes(item.duration)}・{new Date(item.created_at).toLocaleDateString('ja-JP')}</div>
                  </div>
                  <button className="chip btnchip" onClick={() => downloadShared([item])}>⬇</button>
                </div>
              ))}
              <button className="press btn ghost dark-ghost" style={{ height: 46 }} onClick={() => downloadShared(remote.catalog.filter((item) => !have.has(item.id)))}>⬇ とどいた番組を ぜんぶダウンロード</button>
            </>
          )}

          {resumeItem && (
            <>
              <div className="a-label">つづきから</div>
              <EpisodeRow episode={resumeItem} onPlay={() => play([resumeItem.id])} big />
            </>
          )}

          <div className="a-label">保存したリスト</div>
          {lists.length === 0 && <div className="muted s">ライブラリで番組をえらぶと、聞く順番ごと「行き」「帰り」などのリストにできます。</div>}
          {lists.map((list) => {
            const items = list.ids.map((id) => byId[id]).filter(Boolean)
            const seconds = items.reduce((sum, episode) => sum + (episode.duration || 0), 0)
            return (
              <div key={list.id} className="a-card row">
                <div className="ep-ic" style={{ background: '#3A3560' }}>🗂️</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t">{list.name}：{minutes(seconds)}</div>
                  <div className="muted s ellipsis">{items.length ? items.map((episode) => episode.title).join(' → ') : '番組が消えています'}</div>
                </div>
                <button className="chip btnchip" disabled={!items.length} onClick={() => play(items.map((episode) => episode.id))}>▶</button>
                <button className="x" aria-label="リストを消す" onClick={() => removeList(list.id)}>✕</button>
              </div>
            )
          })}

          {fresh.length > 0 && (
            <>
              <div className="a-label">まだ聞いていない番組</div>
              {fresh.map((episode) => <EpisodeRow key={episode.id} episode={episode} onPlay={() => play([episode.id])} />)}
              <button className="press cta" style={{ height: 52, fontSize: 16, background: 'linear-gradient(180deg,#3BD8AE,#2FC79F)', '--d': '#1BA07D' }}
                onClick={() => play(all.filter((episode) => !episode.listened && (episode.audio || episode.chapters?.length)).map((episode) => episode.id))}>
                ▶ まだ聞いていない番組を ぜんぶ聞く
              </button>
            </>
          )}

          <button className="press btn primary" style={{ height: 52 }} onClick={() => setView('catalog')}>📺 番組表から えらんで ダウンロード</button>
          <button className="press btn ghost dark-ghost" style={{ height: 48 }} onClick={() => setView('library')}>📚 ライブラリ（{all.length}本）・リストを作る</button>
          <div className="muted s" style={{ padding: '0 4px', lineHeight: 1.6 }}>※ 声は AI です（Alex＝ロンドン出身の男性、Sam＝アメリカ出身の女性）。番組はこの iPhone に保存されます。</div>
        </div>
        <div style={{ height: 30 }} />
      </div>
    </div>
  )
}

function EpisodeRow({ episode, onPlay, big = false, selected = 0, onSelect, onDelete, onResume, job }) {
  const program = programOf(episode)
  const making = episode.status === 'making'
  const planned = episode.plan?.chapters?.length || 1
  const canPlay = Boolean(episode.audio || episode.chapters?.length)
  return (
    <div className={`a-card ${selected ? 'picked' : ''}`}>
      <div className="row" style={{ gap: 10 }}>
        {onSelect && <button className={`pick ${selected ? 'on' : ''}`} aria-label="えらぶ" disabled={!canPlay} onClick={onSelect}>{selected || ''}</button>}
        <button className="ep-main" disabled={!canPlay} onClick={onPlay}>
          <div className="ep-ic" style={{ background: program.bg }}>{program.emoji}</div>
          <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <div className="t ellipsis">{episode.title}</div>
            <div className="muted s">
              {minutes(episode.duration)}
              {episode.chapters?.length > 1 && `・${episode.chapters.length}章`}
              {making && <span className="badge dl">作成途中 {episode.chapters.length}/{planned}章</span>}
              {!making && !episode.listened && <span className="badge new">未聴</span>}
              {episode.listened && <span className="badge ok">聞いた</span>}
            </div>
          </div>
          {big && <span style={{ fontSize: 24 }}>▶</span>}
        </button>
        {onDelete && <button className="x" aria-label="消す" onClick={onDelete}>けす</button>}
      </div>
      {episode.position > 0 && !episode.listened && episode.duration > 0 && <div className="prog"><i style={{ width: `${Math.min(100, (episode.position / episode.duration) * 100)}%` }} /></div>}
      {making && onResume && !job && <button className="chip btnchip" style={{ marginTop: 8 }} onClick={onResume}>▶ 続きを作る（第{episode.chapters.length + 1}章から）</button>}
    </div>
  )
}

function JobList({ jobs, adult, episodes, compact = false }) {
  return (
    <div className="a-card">
      <div className="t" style={{ marginBottom: 6 }}>⬇ ダウンロード（作成）中</div>
      {jobs.map((job) => (
        <div key={job.id} className="job-row">
          <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ellipsis" style={{ fontWeight: 900, fontSize: 13 }}>{PROGRAMS[job.programId]?.emoji} {job.title}</div>
              <div className="muted s">
                {job.error
                  ? <span style={{ color: '#FF9A8F' }}>{ERRORS[job.error] || ERRORS.failed}。{job.episodeId ? 'できた章までは聞けます' : 'もう一度どうぞ'}</span>
                  : `${STAGES[job.stage] || ''}${job.chapters > 1 && job.stage !== 'queued' && job.stage !== 'done' ? `・第${job.chapter + 1}章/${job.chapters}章` : ''}${job.stage === 'voice' && job.total ? ` ${job.done}/${job.total}` : ''}`}
              </div>
            </div>
            {job.error && job.server && (
              <>
                <button className="chip btnchip" onClick={() => retryProgram(job.id).catch(() => null).then(checkServer)}>もう一度</button>
                <button className="x" onClick={() => cancelProgram(job.id).catch(() => null).then(checkServer)}>✕</button>
              </>
            )}
            {job.error && !job.server && (
              <>
                {job.episodeId && episodes.find((episode) => episode.id === job.episodeId)?.status === 'making' && (
                  <button className="chip btnchip" onClick={() => { const episode = episodes.find((item) => item.id === job.episodeId); dismissJob(job.id); resumeProgram(adult, episode) }}>続きを作る</button>
                )}
                <button className="x" onClick={() => dismissJob(job.id)}>✕</button>
              </>
            )}
          </div>
          {!job.error && job.stage === 'voice' && job.total > 0 && <div className="prog"><i style={{ width: `${(job.done / job.total) * 100}%`, background: '#FFC83D' }} /></div>}
        </div>
      ))}
      {!compact && <div className="muted s" style={{ marginTop: 6 }}>{onServer() ? '☁️ サーバーで作っています。アプリを閉じても・画面を消しても大丈夫。できたら、次に開いたときに自動でダウンロードします' : '📶 Wi-Fi・🔌 充電しながら、画面はつけたままにしてください'}</div>}
    </div>
  )
}

function Catalog({ adult, episodes, jobs, showToast, onBack, onDone }) {
  const [picked, setPicked] = useState({}) // programId → 長さ
  const [topic, setTopic] = useState('')
  const available = (program) => (program.needs === 'chat' ? Boolean(recentTranscript(adult)) : program.needs === 'cards' ? adult.cards.length > 0 : true)
  const chosen = Object.entries(picked)
  const total = chosen.reduce((sum, [id, length]) => {
    const value = estimate(id, length)
    return { minutes: sum.minutes + value.minutes, make: sum.make + value.makeMinutes, mb: sum.mb + value.megabytes }
  }, { minutes: 0, make: 0, mb: 0 })

  const toggle = (program) => {
    if (!available(program)) return showToast(ERRORS[program.needs === 'chat' ? 'no-chat' : 'no-cards'])
    setPicked((prev) => {
      const next = { ...prev }
      if (next[program.id]) delete next[program.id]
      else next[program.id] = program.lengths[program.lengths.length > 1 ? 1 : 0]
      return next
    })
  }

  const download = async () => {
    if (onServer()) {
      try {
        for (const [id, length] of chosen) await requestProgram(adult, id, length, { topic: PROGRAMS[id].topic ? topic.trim() : '' })
        checkServer()
        showToast('サーバーで作りはじめました。アプリを閉じても大丈夫です')
      } catch (error) {
        return showToast(error?.code === 'auth' ? ERRORS.auth : error?.code === 'too_many' ? '同時に頼めるのは8本までです' : 'うまく頼めませんでした。電波のいい所でもう一度')
      }
    } else {
      for (const [id, length] of chosen) enqueueProgram(adult, id, length, { topic: PROGRAMS[id].topic ? topic.trim() : '' })
      showToast('作りはじめました。画面はつけたままにしてね')
    }
    onDone()
  }

  return (
    <div className="screen adult-dark">
      <AdultTop onBack={onBack} title="📺 番組表" />
      <div className="scroll">
        <div className="a-section">
          <div className="muted s">見たいものにチェック → 長さをえらんで、まとめてダウンロード。いくつでも、同じ番組をくり返しても OK。</div>
          {Object.values(PROGRAMS).map((program) => {
            const length = picked[program.id]
            const ok = available(program)
            return (
              <div key={program.id} className={`a-card ${length ? 'picked' : ''}`} style={{ opacity: ok ? 1 : 0.55 }}>
                <div className="row" style={{ gap: 10 }}>
                  <button className={`pick ${length ? 'on' : ''}`} aria-label={`${program.title}をえらぶ`} onClick={() => toggle(program)}>{length ? '✓' : ''}</button>
                  <div className="ep-ic" style={{ background: program.bg }}>{program.emoji}</div>
                  <button style={{ flex: 1, textAlign: 'left', minWidth: 0 }} onClick={() => toggle(program)}>
                    <div className="t">{program.title}</div>
                    <div className="muted s">{ok ? program.about : ERRORS[program.needs === 'chat' ? 'no-chat' : 'no-cards']}</div>
                  </button>
                </div>
                {length && program.lengths.length > 1 && (
                  <div className="len-row">
                    {program.lengths.map((value) => (
                      <button key={value} className={value === length ? 'on' : ''} onClick={() => setPicked((prev) => ({ ...prev, [program.id]: value }))}>{value}{program.unit}</button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {chosen.some(([id]) => PROGRAMS[id].topic) && (
            <div className="a-card">
              <div className="t">話題のリクエスト（なくてもOK）</div>
              <div className="field"><input value={topic} maxLength={60} placeholder="例：海外出張、子育て、映画、サッカー" onChange={(event) => setTopic(event.target.value)} /></div>
            </div>
          )}
          <div className="a-card s" style={{ background: '#262D52' }}>
            {onServer() ? '☁️ サーバーで作るので、頼んだらアプリを閉じても大丈夫。できたら自動でダウンロードします' : '📶 Wi-Fi・🔌 充電中・画面はつけたまま がおすすめ'}<br />
            {chosen.length
              ? `えらんだ${chosen.length}本：合計 約${Math.round(total.minutes)}分・約${total.mb}MB（できあがるまで 約${total.make}分）`
              : 'まだ えらんでいません'}
            {jobs.length > 0 && <><br />いま {jobs.length}本 作成中（そのあとに続けて作ります）</>}
          </div>
          <button className="press cta" style={{ height: 54, fontSize: 17, background: 'linear-gradient(180deg,#3BD8AE,#2FC79F)', '--d': '#1BA07D' }} disabled={!chosen.length} onClick={download}>⬇ {chosen.length || ''}本をまとめてダウンロード</button>
        </div>
        <div style={{ height: 30 }} />
      </div>
    </div>
  )
}

const FILTERS = [['all', 'すべて'], ['new', '未聴'], ['long', 'ロング'], ['done', '聞いた']]

function Library({ adult, episodes, jobs, play, reload, storage, showToast, onBack, onSaveList, onCatalog }) {
  const [filter, setFilter] = useState('all')
  const [order, setOrder] = useState([]) // えらんだ順（この順で連続再生）
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const shown = episodes.filter((episode) => filter === 'all'
    || (filter === 'new' && !episode.listened)
    || (filter === 'long' && episode.duration >= 9 * 60)
    || (filter === 'done' && episode.listened))
  const count = (key) => episodes.filter((episode) => (key === 'new' ? !episode.listened : key === 'long' ? episode.duration >= 9 * 60 : key === 'done' ? episode.listened : true)).length
  const toggle = (id) => setOrder((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  const seconds = order.reduce((sum, id) => sum + (episodes.find((episode) => episode.id === id)?.duration || 0), 0)
  const remove = (episode) => { setOrder((prev) => prev.filter((id) => id !== episode.id)); deleteEpisode(episode.id).then(reload) }
  const removeListened = () => {
    const listened = episodes.filter((episode) => episode.listened)
    if (!listened.length) return showToast('聞いた番組はありません')
    Promise.all(listened.map((episode) => deleteEpisode(episode.id))).then(() => { reload(); showToast(`${listened.length}本 消しました`) })
  }

  return (
    <div className="screen adult-dark">
      <AdultTop onBack={onBack} title="📚 ライブラリ" />
      <div className="scroll">
        <div className="a-section">
          {jobs.length > 0 && <JobList jobs={jobs} adult={adult} episodes={episodes} />}
          <div className="muted s">番組の左の○をタップした順に、続けて聞けます（例：ドラマ → 耳で復習 → TOEIC）。</div>
          <div className="seg3">
            {FILTERS.map(([key, label]) => <button key={key} className={filter === key ? 'on' : ''} onClick={() => setFilter(key)}>{label} {count(key)}</button>)}
          </div>
          {shown.length === 0 && <div className="muted s" style={{ padding: 8 }}>番組がありません。<button className="link-btn" onClick={onCatalog}>番組表からダウンロード</button></div>}
          {shown.map((episode) => (
            <EpisodeRow key={episode.id} episode={episode}
              selected={order.indexOf(episode.id) + 1}
              onSelect={() => toggle(episode.id)}
              onPlay={() => play([episode.id])}
              onDelete={() => remove(episode)}
              onResume={() => resumeProgram(adult, episode)}
              job={jobs.find((job) => job.episodeId === episode.id && !job.error)} />
          ))}
          <div className="a-card s" style={{ background: '#262D52' }}>
            💾 端末の保存：{storage?.usedMb ?? '?'}MB{storage?.quotaMb ? ` / ${Math.round(storage.quotaMb / 100) / 10}GB つかえる` : ''}（1人 30本まで）
            <button className="link-btn" style={{ marginLeft: 6, color: '#7FE3C4' }} onClick={removeListened}>聞いたものを まとめて消す</button>
          </div>
        </div>
        <div style={{ height: order.length ? 120 : 30 }} />
      </div>
      {order.length > 0 && (
        <div className="list-dock">
          {naming ? (
            <div className="row" style={{ gap: 8 }}>
              <input className="dock-input" autoFocus value={name} maxLength={16} placeholder="リストの名前（例：行き）" onChange={(event) => setName(event.target.value)} />
              <button className="press btn primary" disabled={!name.trim()} onClick={() => { onSaveList(name.trim(), order); setNaming(false); setName('') }}>保存</button>
            </div>
          ) : (
            <div className="row" style={{ gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900 }}>{order.length}本えらんだ・{minutes(seconds)}</div>
                <div className="muted s">えらんだ順に聞きます</div>
              </div>
              <button className="press btn ghost dark-ghost" onClick={() => setNaming(true)}>リストに保存</button>
              <button className="press btn primary" onClick={() => play(order)}>▶ 聞く</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
