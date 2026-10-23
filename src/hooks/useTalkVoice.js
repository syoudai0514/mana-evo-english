import { useCallback, useEffect, useRef, useState } from 'react'
import { primePlayback } from '../lib/audio.js'
import { setPlaybackSession } from '../lib/recorder.js'
import { speak, stopSpeech, unlockSpeech } from '../lib/tts.js'

// Automatic speech and a user-requested replay are separate choices.
export function useTalkVoice({
  parentReads,
  live,
  liveAudio,
  voice,
  latest,
  latestPartnerIndex,
  setTalkingIndex,
  finished
}) {
  const [autoVoice, setAutoVoice] = useState(!parentReads)
  const [voiceError, setVoiceError] = useState('')
  const voiceMuted = useRef(Boolean(parentReads))
  const generation = useRef(0),
    mounted = useRef(true),
    current = useRef({})
  current.current = { voice, latest, latestPartnerIndex }
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      generation.current++
    }
  }, [])
  const wake = () => {
    setPlaybackSession()
    primePlayback()
    unlockSpeech()
  }
  const read = useCallback(
    async (text, index) => {
      if (!text || finished.current) return
      const id = ++generation.current
      setVoiceError('')
      setTalkingIndex(index)
      try {
        const outcome = await speak(text, current.current.voice)
        if (
          mounted.current &&
          id === generation.current &&
          outcome?.completed === false
        )
          setVoiceError(
            '音声を再生できませんでした。もう一度🔊を押してください。'
          )
      } catch {
        if (mounted.current && id === generation.current)
          setVoiceError(
            '音声を再生できませんでした。もう一度🔊を押してください。'
          )
      } finally {
        if (mounted.current && id === generation.current) setTalkingIndex(-1)
      }
    },
    [finished, setTalkingIndex]
  )
  const replay = useCallback(
    async (turn, index) => {
      if (!turn?.text || finished.current) return
      wake()
      stopSpeech()
      live.current?.player?.stop()
      setVoiceError('')
      const audio = liveAudio.current.get(turn.opener ? 'opener' : turn.turnId)
      if (live.current && audio?.length) {
        try {
          live.current.replay(audio)
          return
        } catch {
          /* Device voice remains available if the audio context failed. */
        }
      }
      return read(turn.text, index)
    },
    [live, liveAudio, read, finished]
  )
  const say = useCallback(
    (text, index) => {
      if (voiceMuted.current || !text) return
      return read(text, index)
    },
    [read]
  )
  const toggleVoice = () => {
    const muted = !voiceMuted.current
    voiceMuted.current = muted
    setAutoVoice(!muted)
    setVoiceError('')
    generation.current++
    stopSpeech()
    setTalkingIndex(-1)
    const session = live.current
    if (session) {
      session.muted = muted
      if (muted) session.player.stop()
    }
    if (!muted) {
      wake()
      session?.wake()
      if (!session?.generating && current.current.latest)
        replay(current.current.latest, current.current.latestPartnerIndex)
    }
  }
  return { autoVoice, voiceMuted, voiceError, toggleVoice, say, replay }
}
