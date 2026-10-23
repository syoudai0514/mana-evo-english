import { useRef } from 'react'
import { Recorder } from '../../lib/recorder.js'
import { isMockMode } from '../../lib/config.js'
import { unlockSpeech, stopSpeech } from '../../lib/tts.js'
export function useTalkRecording({
  busy,
  recording,
  stopped,
  stopping,
  live,
  setCaption,
  say2,
  persona,
  pressing,
  setPressed,
  recorder,
  setMicLevel,
  transcriber,
  usingAsr,
  heldChunks,
  newLiveTurn,
  setRecording,
  guide,
  recordingRef,
  setTyping,
  setLiveBubble,
  waitForReply,
  liveTurn,
  finished,
  withWrap,
  childSends,
  notHeard,
  send
}) {
  // 1回押すごとの番号。前の押した回のタイマーや遅れた処理が、今の回をこわさないように
  const pressId = useRef(0)
  const handledPress = useRef(0)

  // 送らずに、この発話を閉じる（相棒・文字起こしに「話しはじめ」だけ残さない）
  const abandonTake = () => {
    if (usingAsr.current) transcriber.current?.end()
    else live.current?.endSpeech()
  }

  const startRecording = async (event) => {
    event?.preventDefault()
    if (
      finished.current ||
      busy ||
      recording ||
      stopped ||
      pressing.current ||
      stopping.current
    )
      return
    // つないでいる途中・つなぎなおし中は待ってもらう（1回ずつ送る方式に流れないように）
    if (!live.current && !isMockMode())
      return setCaption(
        say2(
          `${persona.name}に つないでるよ… ちょっと まってね`,
          `${persona.name}に接続中です。少し待ってください`
        )
      )
    pressing.current = true
    setPressed(true)
    const id = ++pressId.current
    unlockSpeech()
    stopSpeech()
    live.current?.wake() // タップの中で、相棒の声の AudioContext を起こしておく
    try {
      if (!recorder.current) {
        recorder.current = new Recorder()
        recorder.current.onLevel = setMicLevel
      }
      recorder.current.onMax = () => {
        if (pressId.current === id) finishTake(id)
      } // 長く押しすぎたら、そこで送る
      if (live.current) {
        newLiveTurn()
        heldChunks.current = []
        const asr = transcriber.current?.ready ? transcriber.current : null
        if (transcriber.current && !asr) transcriber.current.ensure() // 切れていたら、次に押すときのためにつなぎなおす
        usingAsr.current = Boolean(asr)
        if (asr) {
          // 声は文字起こし専用モデルへ。相棒には確定した文字を渡す（聞きまちがいが少ない）
          live.current.silenceCurrentTurn()
          asr.begin()
          recorder.current.onChunk = (chunk) => {
            heldChunks.current.push(chunk)
            asr.sendAudio(chunk)
          }
        } else {
          live.current.beginSpeech()
          recorder.current.onChunk = (chunk) => live.current?.sendAudio(chunk)
        }
      } else {
        recorder.current.onChunk = null
      }
      const rec = recorder.current
      await rec.start()
      // マイクが開くまでに指を離していたら、録音しない（マイクも、話しはじめも閉じる）
      if (finished.current || !pressing.current || pressId.current !== id) {
        rec.stop()
        rec.release()
        abandonTake()
        setPressed(false)
        setCaption(
          guide('ぎゅーっと おしたまま はなしてね', '押したまま話してください')
        )
        return
      }
      setRecording(true)
      setCaption(
        say2(
          'はなしてね… はなしたら ゆびを はなす',
          '話し終わったら指を離してください'
        )
      )
      // 0.8秒たっても音が届かなければ、マイクが止まっている。作りなおして、もういちど押してもらう
      setTimeout(() => {
        if (
          pressId.current !== id ||
          handledPress.current === id ||
          !rec.silentSinceStart
        )
          return
        handledPress.current = id
        rec.stop()
        rec.release()
        abandonTake()
        pressing.current = false
        setPressed(false)
        setRecording(false)
        setCaption(
          guide(
            'あれれ？ もういちど おしてね',
            'マイクを準備しました。もう一度押してください'
          )
        )
      }, 1500)
    } catch {
      pressing.current = false
      setPressed(false)
      setRecording(false)
      abandonTake()
      setTyping(true)
      setCaption(
        guide(
          'マイクが つかえないよ。おうちのひとに きいてね',
          'マイクが使えません。文字で入力してください'
        )
      )
    }
  }

  const stopRecording = (event) => {
    event?.preventDefault()
    pressing.current = false
    setPressed(false)
    // 描きかえ前でも分かるよう、ref で見る（マイクが開いた直後に離したのを見のがさない）
    if (!recordingRef.current) return
    finishTake(pressId.current)
  }

  // 話し終わり（指を離した・長すぎて自動で止まった）。1回押すごとに1度だけ
  const finishTake = (id) => {
    if (handledPress.current === id) return
    handledPress.current = id
    live.current?.wake()
    setRecording(false)
    setMicLevel(0)
    // 指を離したあとも少しだけ録りつづける（言い終わりが切れないように）
    const rec = recorder.current
    stopping.current = true
    setTimeout(async () => {
      stopping.current = false
      if (finished.current) {
        rec.stop()
        rec.release()
        abandonTake()
        return
      }
      if (!rec.hasTake) {
        rec.release()
        abandonTake()
        return
      }
      const audio = rec.stop()
      rec.release()
      // 押している間に接続が切れた：つなぎなおしを待ってもらう（「つながらない」にはしない）
      if (!live.current && !isMockMode()) {
        if (usingAsr.current) transcriber.current?.end()
        abandonTake()
        setCaption(
          guide(
            'つなぎなおしてるよ… もういちど おしてね',
            'つなぎ直しています。もう一度押してください'
          )
        )
        return
      }
      if (live.current && usingAsr.current) {
        if (audio.seconds < 0.3) {
          transcriber.current?.end()
          return setCaption(
            guide(
              'ぎゅーっと おしたまま はなしてね',
              '少し長めに押しながら話してください'
            )
          )
        }
        setLiveBubble('child', '…')
        setCaption('')
        waitForReply()
        const text = await transcriber.current.end()
        if (!live.current || finished.current) return
        if (text) {
          liveTurn.current.child = text
          liveTurn.current.typed = true
          setLiveBubble('child', text)
          live.current.sendText(withWrap(text))
        } else if (audio.loudness >= 0.004) {
          // 文字にならなかったときは、相棒に声をそのまま送る
          live.current.beginSpeech()
          for (const chunk of heldChunks.current) live.current.sendAudio(chunk)
          if (!live.current.endSpeech()) notHeard()
          else childSends.current += 1
        } else {
          notHeard()
        }
        return
      }
      if (live.current) {
        const sent = live.current.endSpeech()
        if (audio.seconds < 0.3)
          return setCaption(
            guide(
              'ぎゅーっと おしたまま はなしてね',
              '少し長めに押しながら話してください'
            )
          )
        if (!sent) return notHeard()
        childSends.current += 1
        setLiveBubble('child', '…')
        setCaption('')
        return waitForReply()
      }
      if (audio.seconds < 0.3)
        return setCaption(
          guide(
            'ぎゅーっと おしたまま はなしてね',
            '少し長めに押しながら話してください'
          )
        )
      if (audio.loudness < 0.004)
        return setCaption(
          guide(
            'こえが きこえなかったよ。もういちど！',
            '声が聞こえませんでした。もう一度どうぞ'
          )
        )
      send({ audio: { mime: audio.mime, data: audio.base64 } })
    }, 300)
  }

  return { startRecording, stopRecording }
}
