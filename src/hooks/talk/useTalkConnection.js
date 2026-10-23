import { useEffect, useRef } from 'react'
import {
  Recorder,
  micSupported,
  setPlaybackSession
} from '../../lib/recorder.js'
import { isMockMode } from '../../lib/config.js'
import { stopSpeech } from '../../lib/tts.js'
export function useTalkConnection(options) {
  const {
    live,
    goAwaySoon,
    pressing,
    stopping,
    busyRef,
    refreshLive,
    recorder,
    setMicLevel,
    finished,
    startTurnEngine,
    startLive,
    setStopped,
    transcriber,
    annotator,
    waitTimer,
    bubbleTimer
  } = options
  const latest = useRef(options)
  latest.current = options
  useEffect(() => {
    const timer = setInterval(() => {
      const session = live.current
      const due = session && (session.age > 100000 || goAwaySoon.current)
      if (
        due &&
        !pressing.current &&
        !stopping.current &&
        !busyRef.current &&
        !session.speaking
      )
        latest.current.refreshLive()
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  // はじめのひとこと。Live につながればリアルタイム、だめなら1回ずつ送る方式
  useEffect(() => {
    if (micSupported()) {
      recorder.current = new Recorder()
      recorder.current.onLevel = setMicLevel
      // マイクは押している間だけ開く（開きっぱなしだと iPhone で相棒の声がブツブツになる）
      setPlaybackSession()
    }
    // 会話も読みづくりも、Live の中だけで行う（確認用の mock だけ1回ずつの方式）
    if (isMockMode()) latest.current.startTurnEngine()
    else
      latest.current.startLive().catch((error) => {
        if (!finished.current)
          setStopped(error?.code === 'auth' ? 'auth' : 'offline')
      })
    return () => {
      finished.current = true // 画面を離れたら、つないでいる途中のものも使わない
      stopSpeech()
      recorder.current?.release()
      live.current?.close()
      transcriber.current?.close()
      annotator.current?.close()
      clearTimeout(waitTimer.current)
      clearTimeout(bubbleTimer.current)
    }
  }, [])
}
