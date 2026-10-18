// シャドーイングと発音チェック：お手本を聞いて、まねして言う。言えた単語は緑、あやしい単語は黄色
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { PRON_TIPS, PRON_TIPS_PROMPT } from '../data/adult.js'
import { compareShadow, shadowSentences, withShadow } from '../lib/adult.js'
import { SilentTool } from '../lib/annotator.js'
import { isMockMode } from '../lib/config.js'
import { useHoldToSpeak } from '../lib/useHoldToSpeak.js'
import { prepareReader } from '../lib/reader.js'
import { AdultTop, HoldMic, ScoreRing, speakEnglish } from '../components/adultUi.jsx'

// 会話がまだ少ないときのお手本
const STARTERS = [
  { en: 'They pushed back the release to next month.', ja: 'リリースを来月に延期した。' },
  { en: 'Could you send me the file by Friday?', ja: '金曜までにファイルを送ってもらえますか？' },
  { en: 'I\'m swamped with work this week.', ja: '今週は仕事で手一杯です。' }
]

export default function Shadow({ adult, updateAdult, onDone }) {
  const sentences = useMemo(() => {
    const picks = shadowSentences(adult, 3)
    return [...picks, ...STARTERS].slice(0, 3)
  }, [])
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState(null) // { marks, score, missed, text }
  const [tips, setTips] = useState([])
  const [slow, setSlow] = useState(false)
  const scores = useRef([])
  const coach = useRef(null)
  const sentence = sentences[index]

  useEffect(() => {
    prepareReader()
    if (!isMockMode()) coach.current = new SilentTool({ system: PRON_TIPS_PROMPT, declaration: PRON_TIPS, step: 'pron-tips', timeoutMs: 12000 })
    return () => coach.current?.close()
  }, [])
  useEffect(() => { speakEnglish(sentence.en) }, [index])

  const hold = useHoldToSpeak({
    vocabulary: sentence.en.split(/\s+/),
    onText: async (text) => {
      const compared = compareShadow(sentence.en, text)
      setResult({ ...compared, text })
      setTips([])
      if (compared.missed.length && text && coach.current) {
        setTips(null) // 調べ中
        const reply = await coach.current.ask(`Sentence: "${sentence.en}"\nMissed words: ${compared.missed.join(', ')}`)
        setTips(Array.isArray(reply?.tips) ? reply.tips.slice(0, 3) : [])
      }
    }
  })

  const next = () => {
    if (result) {
      scores.current.push(result.score)
      updateAdult((current) => withShadow(current, result.score))
    }
    setResult(null)
    setTips([])
    if (index + 1 >= sentences.length) onDone(scores.current.length ? { shadowScores: scores.current } : {})
    else setIndex(index + 1)
  }

  return (
    <div className="screen adult-dark">
      <AdultTop onBack={() => onDone(scores.current.length ? { shadowScores: scores.current } : {}, { stop: true })} backLabel="✕"
        title={<>🎧 シャドーイング <span className="muted" style={{ marginLeft: 4, fontSize: 12 }}>{index + 1}/{sentences.length}</span></>}
        right={<button className="icon-btn" aria-label="ゆっくり" onClick={() => setSlow((value) => !value)} style={slow ? { background: 'var(--mint)' } : undefined}>🐢</button>} />
      <div className="scroll">
        <div className="a-card shadow-card">
          <span className="chip">お手本</span>
          <div className="model">{sentence.en}</div>
          {sentence.ja && <div className="a-ja">{sentence.ja}</div>}
          <div className="chips">
            <button className="chip" onClick={() => speakEnglish(sentence.en)}>🔊 ふつう</button>
            <button className="chip" onClick={() => speakEnglish(sentence.en, { slow: true })}>🐢 ゆっくり</button>
            <button className="chip" onClick={async () => { await speakEnglish(sentence.en, { slow }); await speakEnglish(sentence.en, { slow }) }}>🔁 2回</button>
          </div>
        </div>
        {result && (
          <div className="a-card shadow-card">
            <span className="chip">あなた</span>
            <div className="model">
              {result.marks.map((mark, i) => <span key={i} className={mark.ok === null ? '' : mark.ok ? 'w-ok' : 'w-miss'}>{mark.text}</span>)}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
              <ScoreRing score={result.score} />
              <div className="tips">
                {result.score >= 90 && <div>ばっちり！ このリズムで</div>}
                {!result.text && <div>聞き取れませんでした。もう一度どうぞ</div>}
                {(tips || []).map((tip) => <div key={tip.word}><b>{tip.word}</b>：{tip.tip_ja}</div>)}
                {tips === null && <div className="muted">コツを調べています…</div>}
                {tips?.length === 0 && result.text && result.missed.length > 0 && <div>黄色の単語を、お手本をよく聞いてもう一度</div>}
              </div>
            </div>
          </div>
        )}
        <div className="muted center" style={{ fontSize: 12, margin: '10px 20px 0' }}>お手本のすぐあとを追いかけるように言うのがコツ</div>
        <HoldMic hold={hold} label={result ? 'もう一度言う' : '押しながら まねして言う'} />
        {(result || !hold.available) && <div style={{ padding: '6px 16px 20px' }}><button className="press cta" style={{ height: 52, fontSize: 17 }} onClick={next}>{index + 1 >= sentences.length ? 'おわり ▶' : 'つぎの文 ▶'}</button></div>}
      </div>
    </div>
  )
}
