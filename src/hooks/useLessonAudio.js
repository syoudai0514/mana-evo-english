import { useEffect, useRef, useState } from 'react'
import { speak, stopSpeech, unlockSpeech } from '../lib/tts.js'
export function useLessonAudio({ onEvent } = {}) {
  const [playing, setPlaying] = useState(false),
    [active, setActive] = useState(-1),
    [error, setError] = useState('')
  const sequence = useRef(0)
  const stop = () => {
    sequence.current++
    stopSpeech()
    setPlaying(false)
    setActive(-1)
  }
  useEffect(
    () => () => {
      sequence.current++
      stopSpeech()
    },
    []
  )
  const play = async (lines, { slow = false, start = 0 } = {}) => {
    stop()
    setError('')
    unlockSpeech()
    const id = ++sequence.current
    setPlaying(true)
    for (let i = start; i < lines.length; i++) {
      if (id !== sequence.current) break
      setActive(i)
      const row = typeof lines[i] === 'string' ? { en: lines[i] } : lines[i]
      onEvent?.({ text: row.en, event: 'requested', at: Date.now() })
      const outcome = await speak(row.en, {
        rate: slow ? 0.68 : 0.94,
        gender: row.speaker === 'Sam' ? 'female' : 'male'
      })
      if (id !== sequence.current) break
      if (!outcome?.completed)
        setError(
          '音声の再生完了を確認できませんでした。もう一度再生するか、文字で練習できます。'
        )
      onEvent?.({
        text: row.en,
        event: outcome?.completed ? 'completed' : 'unconfirmed',
        at: Date.now()
      })
    }
    if (id === sequence.current) {
      setPlaying(false)
      setActive(-1)
    }
  }
  return {
    play,
    stop,
    error,
    playing,
    active,
    available: typeof window !== 'undefined' && Boolean(window.speechSynthesis)
  }
}
