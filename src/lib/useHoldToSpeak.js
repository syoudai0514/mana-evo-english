// 「おしながら話す」→ 文字にする（3.5 Transcribe Live）。復習カード・シャドーイング・TOEIC の声の答えで使う。
// 文字起こしにつながっていなければ、つながるまでの声をためておいて、つながったら送る。
import { useEffect, useRef, useState } from 'react'
import { Recorder, micSupported } from './recorder.js'
import { Transcriber } from './transcriber.js'
import { isMockMode } from './config.js'
import { stopSpeech, unlockSpeech } from './tts.js'

export function useHoldToSpeak({ vocabulary = [], onText }) {
  const [recording, setRecording] = useState(false)
  const [level, setLevel] = useState(0)
  const [busy, setBusy] = useState(false)
  const recorder = useRef(null)
  const transcriber = useRef(null)
  const pressing = useRef(false)
  const pending = useRef([]) // つながる前の声
  const began = useRef(false)
  const onTextRef = useRef(onText)
  onTextRef.current = onText
  const available = micSupported() && !isMockMode()

  useEffect(() => {
    if (!available) return undefined
    transcriber.current = new Transcriber({ transcription: { languageCodes: ['en-US', 'ja-JP'], customVocabulary: vocabulary.slice(0, 40) } })
    transcriber.current.ensure()
    recorder.current = new Recorder()
    recorder.current.onLevel = setLevel
    recorder.current.warmUp()
    return () => { recorder.current?.close(); transcriber.current?.close() }
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
    if (!available || busy || recording) return
    pressing.current = true
    unlockSpeech()
    stopSpeech()
    pending.current = []
    began.current = false
    const asr = transcriber.current
    if (!asr.ready) asr.ensure().then(() => { if (pressing.current || recording) flush() })
    else flush()
    recorder.current.onChunk = (chunk) => { pending.current.push(chunk); flush() }
    try {
      await recorder.current.start()
      if (!pressing.current) { recorder.current.stop(); return }
      setRecording(true)
    } catch {
      pressing.current = false
    }
  }

  const stop = (event) => {
    event?.preventDefault()
    pressing.current = false
    if (!recording) return
    setRecording(false)
    setLevel(0)
    const rec = recorder.current
    setTimeout(async () => {
      if (!rec.isRecording) return
      const audio = rec.stop()
      if (audio.seconds < 0.4) return
      setBusy(true)
      // 押している間につながらなかったときは、少し待ってからためた声を送る
      if (!transcriber.current.ready) await Promise.race([transcriber.current.ensure(), new Promise((resolve) => setTimeout(resolve, 2500))])
      flush()
      const text = began.current ? await transcriber.current.end() : ''
      setBusy(false)
      onTextRef.current?.(text)
    }, 300)
  }

  const bind = {
    onPointerDown: start,
    onPointerUp: stop,
    onPointerCancel: stop,
    onPointerLeave: stop,
    onContextMenu: (event) => event.preventDefault()
  }

  return { available, recording, level, busy, bind }
}
