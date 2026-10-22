// 「おしながら話す」→ 文字にする（3.5 Transcribe Live）。復習カード・シャドーイング・TOEIC の声の答えで使う。
// 文字起こしにつながっていなければ、つながるまでの声をためておいて、つながったら送る。
import { useEffect, useRef, useState } from 'react'
import { Recorder, micSupported, setPlaybackSession } from './recorder.js'
import { Transcriber } from './transcriber.js'
import { isMockMode } from './config.js'
import { stopSpeech, unlockSpeech } from './tts.js'
import { primePlayback } from './audio.js'

export function useHoldToSpeak({ vocabulary = [], onText }) {
  const [recording, setRecordingState] = useState(false)
  const recordingRef = useRef(false) // 描きかえ前でも分かるように
  const setRecording = (value) => { recordingRef.current = value; setRecordingState(value) }
  const stopping = useRef(false) // 離したあとの 0.3 秒（この間に押しなおすと、前の声が消えるので受けつけない）
  const [level, setLevel] = useState(0)
  const [busy, setBusy] = useState(false)
  const recorder = useRef(null)
  const transcriber = useRef(null)
  const pressing = useRef(false)
  const pending = useRef([]) // つながる前の声
  const began = useRef(false)
  const pressId = useRef(0) // 1回押すごとの番号（前の回の遅れた処理が今の回をこわさないように）
  const handled = useRef(0)
  const onTextRef = useRef(onText)
  onTextRef.current = onText
  const available = micSupported() && !isMockMode()

  useEffect(() => {
    if (!available) return undefined
    transcriber.current = new Transcriber({ transcription: { languageCodes: ['en-US', 'ja-JP'], customVocabulary: vocabulary.slice(0, 40) } })
    transcriber.current.ensure()
    recorder.current = new Recorder()
    recorder.current.onLevel = setLevel
    setPlaybackSession() // マイクは押している間だけ開く
    return () => { recorder.current?.release(); transcriber.current?.close() }
  }, [])

  const flush = () => {
    const asr = transcriber.current
    if (!asr?.ready) return
    if (!began.current) { asr.begin(); began.current = true }
    for (const chunk of pending.current) asr.sendAudio(chunk)
    pending.current = []
  }

  const start = async (event) => {
    event?.preventDefault()
    if (!available || busy || recordingRef.current || pressing.current || stopping.current) return
    pressing.current = true
    const id = ++pressId.current
    unlockSpeech()
    stopSpeech()
    primePlayback()
    pending.current = []
    began.current = false
    const asr = transcriber.current
    // つながるのが遅れて、もう離したあとなら送らない（離したほうの処理が送る。終わりのない声を送らない）
    if (!asr.ready) asr.ensure().then(() => { if (pressId.current === id && pressing.current) flush() })
    else flush()
    const rec = recorder.current
    rec.onChunk = (chunk) => { pending.current.push(chunk); flush() }
    rec.onMax = () => { if (pressId.current === id) finish(id) } // 長く押しすぎたら、そこで判定する
    try {
      await rec.start()
      // マイクが開くまでに指を離していたら、マイクを閉じて終わり
      if (!pressing.current || pressId.current !== id) { rec.stop(); rec.release(); if (began.current) transcriber.current.end(); return }
      setRecording(true)
    } catch {
      pressing.current = false
      if (began.current) transcriber.current.end()
    }
  }

  const stop = (event) => {
    event?.preventDefault()
    pressing.current = false
    if (!recordingRef.current) return
    finish(pressId.current)
  }

  const finish = (id) => {
    if (handled.current === id) return
    handled.current = id
    setRecording(false)
    setLevel(0)
    const rec = recorder.current
    stopping.current = true
    setTimeout(async () => {
      stopping.current = false
      if (!rec.hasTake) { rec.release(); return }
      const audio = rec.stop()
      rec.release()
      if (audio.seconds < 0.4) { if (began.current) transcriber.current.end(); return }
      setBusy(true)
      // 押している間につながらなかったときは、少し待ってからためた声を送る
      if (!transcriber.current.ready) await Promise.race([transcriber.current.ensure(), new Promise((resolve) => setTimeout(resolve, 2500))])
      flush()
      const text = began.current ? await transcriber.current.end() : ''
      setBusy(false)
      onTextRef.current?.(text, id)
    }, 300)
  }

  const bind = {
    onKeyDown: event => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) start(event) },
    onKeyUp: event => { if (event.key === ' ' || event.key === 'Enter') stop(event) },
    onBlur: stop,
    onPointerDown: start,
    onPointerUp: stop,
    onPointerCancel: stop,
    onPointerLeave: stop,
    onContextMenu: (event) => event.preventDefault()
  }

  return { available, recording, level, busy, bind }
}
