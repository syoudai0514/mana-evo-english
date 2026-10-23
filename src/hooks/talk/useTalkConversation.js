import { useEffect, useRef, useState } from 'react'
import { kidTurnLimit } from '../../data/levels.js'
export function useTalkConversation(options) {
  const {
    config,
    adult,
    level,
    childTurnCount,
    startedAt,
    live,
    wrapped,
    busyRef,
    pressing,
    stopping,
    childCount,
    newLiveTurn,
    waitForReply,
    turns,
    busy,
    logRef
  } = options
  const latest = useRef(options)
  latest.current = options
  const [elapsed, setElapsed] = useState(0)
  // 大人：時間を決めた会話。時間が来たら相棒にまとめてもらい、「お勉強へ」を出す
  useEffect(() => {
    if (!config.minutes) return undefined
    const timer = setInterval(
      () =>
        setElapsed(
          (Date.now() - new Date(startedAt.current).getTime()) / 60000
        ),
      5000
    )
    return () => clearInterval(timer)
  }, [])
  // 子ども：段階に合わせた回数（はじめは6回）話したら、相棒にさよならしてもらう（長すぎて飽きないように）
  // （ふだんは決めた回数めの答えといっしょに送る。声をそのまま送ったときなどは、もう1回話したあとにここで送る）
  const kidLimit = adult
    ? 0
    : config.mode === 'free' || config.mode === 'play'
      ? kidTurnLimit(level.level)
      : config.mode === 'guess'
        ? 12
        : 0
  const timeUp =
    (Boolean(config.minutes) && elapsed >= config.minutes) ||
    (kidLimit > 0 && childTurnCount > kidLimit)
  // まとめを頼むのは、相棒が話し終わり、ボタンも押していないときだけ（話の途中で切らない）
  useEffect(() => {
    if (!timeUp) return undefined
    const timer = setInterval(() => {
      const session = live.current
      if (
        wrapped.current ||
        busyRef.current ||
        !session ||
        session.speaking ||
        pressing.current ||
        stopping.current ||
        childCount() < 2
      )
        return
      wrapped.current = true
      latest.current.newLiveTurn()
      session.sendText('[WRAP_UP]')
      latest.current.waitForReply()
    }, 1000)
    return () => clearInterval(timer)
  }, [timeUp])

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: 'smooth'
    })
  }, [turns.length, busy])

  return { elapsed, timeUp, kidLimit }
}
