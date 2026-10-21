// 電車モード（大人だけ）：話さずに聞く番組。家の Wi-Fi で準備しておき、電車では聞くだけ
import React, { useEffect, useRef, useState } from 'react'
import { TRAIN_KINDS } from '../data/train.js'
import { deleteEpisode, listEpisodes } from '../lib/episodeStore.js'
import { clearJobError, jobKey, prepareEpisode, subscribeJobs } from '../lib/trainJobs.js'
import { recentTranscript } from '../lib/episodes.js'
import { primePlayback } from '../lib/audio.js'
import { unlockTrainAudio } from '../lib/trainAudio.js'
import { AdultTop } from '../components/adultUi.jsx'

const ERRORS = {
  'no-chat': 'まだ Alex との雑談がありません（3往復以上話すと作れます）',
  'no-cards': '復習カードがまだありません（雑談すると増えます）',
  script: '台本がうまく作れませんでした。もう一度どうぞ',
  voice: '声の準備がうまくいきませんでした。電波のいい所でもう一度',
  auth: 'ログインが切れています（保護者画面からログイン）',
  failed: 'うまく作れませんでした。もう一度どうぞ'
}

function minutes(seconds) {
  return `${Math.max(1, Math.round(seconds / 60))}分`
}

export default function Train({ adult, navigate, onPlay, showToast }) {
  const [episodes, setEpisodes] = useState(null)
  const [jobs, setJobs] = useState({})
  const [topic, setTopic] = useState('')
  const [asking, setAsking] = useState(false)

  const reload = () => listEpisodes(adult.id).then(setEpisodes).catch(() => setEpisodes([]))
  useEffect(() => { reload() }, [adult.id])
  // 作り終わったら一覧を読みなおす
  // （進み具合が変わるたびに読みなおすと重いので、終わった・失敗したときだけ）
  const finishedCount = useRef(-1)
  useEffect(() => subscribeJobs((next) => {
    setJobs(next)
    const active = Object.values(next).filter((item) => !item.error).length
    if (active !== finishedCount.current) { finishedCount.current = active; reload() }
  }), [adult.id])

  const latest = (kind) => episodes?.find((episode) => episode.kind === kind)
  const job = (kind) => jobs[jobKey(adult.id, kind)]
  const busyWith = (kind) => Boolean(job(kind) && !job(kind).error) // 失敗したものは、もう一度ためせる
  const canMake = (kind) => (kind === 'mine' ? Boolean(recentTranscript(adult)) : kind === 'cards' ? adult.cards.length > 0 : true)

  const prepare = (kind, options) => {
    clearJobError(adult.id, kind)
    prepareEpisode(kind, adult, options)
  }

  const prepareAll = () => {
    for (const kind of Object.keys(TRAIN_KINDS)) if (canMake(kind) && !busyWith(kind)) prepare(kind)
    showToast('番組を準備しています。Wi-Fi のある所で少し待ってね')
  }

  const playAll = () => {
    // 声を出さずに続けて聞けるもの（TOEIC はタップで答えるので入れない）
    const ids = Object.values(TRAIN_KINDS).filter((kind) => kind.flow).map((kind) => latest(kind.id)).filter((episode) => episode && !episode.listened).map((episode) => episode.id)
    if (!ids.length) return showToast('まだ聞いていない番組がありません。「準備する」を押してね')
    primePlayback()
    unlockTrainAudio()
    onPlay(ids)
  }

  const ready = Object.keys(TRAIN_KINDS).map(latest).filter(Boolean)
  const total = ready.filter((episode) => !episode.listened).reduce((sum, episode) => sum + episode.duration, 0)
  const older = (episodes || []).filter((episode) => !ready.includes(episode))

  return (
    <div className="screen adult-dark">
      <AdultTop onBack={() => navigate('adultHome')} title="🚃 電車モード" />
      <div className="scroll">
        <div className="a-section">
          <div>
            <div className="en" style={{ font: '800 24px var(--en)' }}>Today's listening</div>
            <div className="muted s">話さなくてOK・イヤホン推奨。番組は家の Wi-Fi で先に準備しておくと、電車では聞くだけ{total ? `（まだ聞いていない分 ${minutes(total)}）` : ''}</div>
          </div>

          {Object.values(TRAIN_KINDS).map((kind) => {
            const episode = latest(kind.id)
            const running = job(kind.id)
            const fresh = episode && !episode.listened
            return (
              <div key={kind.id} className="a-card">
                <div className="ep-row">
                  <button className="ep-main" disabled={!episode} onClick={() => { primePlayback(); unlockTrainAudio(); onPlay([episode.id]) }}>
                    <div className="ep-ic" style={{ background: kind.bg }}>{kind.emoji}</div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div className="t">{kind.title}</div>
                      <div className="muted s">{episode ? `「${episode.title}」・${minutes(episode.duration)}${episode.listened ? '・聞いた' : ''}` : kind.about}</div>
                    </div>
                  </button>
                  {running && !running.error
                    ? <span className="chip">{running.stage === 'queued' ? 'じゅんばん待ち…' : running.stage === 'script' ? '台本づくり…' : `声の準備 ${running.done}/${running.total}`}</span>
                    : fresh
                      ? <span className="chip ok">準備OK</span>
                      : <button className="chip btnchip" disabled={!canMake(kind.id)} onClick={() => prepare(kind.id)}>{episode ? '新しく作る' : '準備する'}</button>}
                </div>
                {episode && episode.position > 0 && !episode.listened && <div className="prog"><i style={{ width: `${Math.min(100, (episode.position / episode.duration) * 100)}%` }} /></div>}
                {running && !running.error && running.total > 0 && <div className="prog"><i style={{ width: `${(running.done / running.total) * 100}%`, background: '#FFC83D' }} /></div>}
                {running?.error && <div className="muted s" style={{ marginTop: 6, color: '#FF9A8F' }}>{ERRORS[running.error] || ERRORS.failed}</div>}
                {!canMake(kind.id) && !episode && <div className="muted s" style={{ marginTop: 6 }}>{ERRORS[kind.id === 'mine' ? 'no-chat' : 'no-cards']}</div>}
              </div>
            )
          })}

          <button className="press cta" style={{ height: 54, fontSize: 17, background: 'linear-gradient(180deg,#3BD8AE,#2FC79F)', '--d': '#1BA07D' }} onClick={playAll}>▶ 続けて全部聞く</button>
          <button className="press btn ghost dark-ghost" style={{ height: 48 }} onClick={prepareAll}>まとめて準備する（Wi-Fi で）</button>

          {asking ? (
            <div className="a-card">
              <div className="t">話題をリクエスト</div>
              <div className="field"><input value={topic} maxLength={60} placeholder="例：海外出張、子育て、映画、サッカー" onChange={(event) => setTopic(event.target.value)} /></div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="press btn ghost dark-ghost" style={{ flex: 1 }} onClick={() => setAsking(false)}>やめる</button>
                <button className="press btn primary" style={{ flex: 2 }} disabled={!topic.trim() || busyWith('chat')} onClick={() => { prepare('chat', { topic: topic.trim() }); setAsking(false); setTopic('') }}>この話題で雑談を作る</button>
              </div>
            </div>
          ) : (
            <button className="link-btn center" style={{ display: 'block', margin: '0 auto', color: '#A9AED8' }} onClick={() => setAsking(true)}>＋ 話題をリクエスト（例：海外出張、子育て、映画）</button>
          )}

          {older.length > 0 && (
            <div className="a-card">
              <div className="t" style={{ marginBottom: 4 }}>前の番組</div>
              {older.map((episode) => (
                <div key={episode.id} className="mem">
                  <button style={{ flex: 1, textAlign: 'left' }} onClick={() => { primePlayback(); unlockTrainAudio(); onPlay([episode.id]) }}>
                    {TRAIN_KINDS[episode.kind]?.emoji} {episode.title}<br /><span className="muted" style={{ fontSize: 11 }}>{new Date(episode.createdAt).toLocaleDateString('ja-JP')}・{minutes(episode.duration)}{episode.listened ? '・聞いた' : ''}</span>
                  </button>
                  <button className="x" onClick={() => deleteEpisode(episode.id).then(reload)}>けす</button>
                </div>
              ))}
            </div>
          )}
          <div className="muted s" style={{ padding: '0 4px', lineHeight: 1.6 }}>※ 声は AI です（Alex＝ロンドン出身の男性、Sam＝アメリカ出身の女性）。準備した番組はこの iPhone に保存され、通信なしで聞けます。</div>
        </div>
        <div style={{ height: 30 }} />
      </div>
    </div>
  )
}
