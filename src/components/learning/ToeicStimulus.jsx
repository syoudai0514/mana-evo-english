import React, { useEffect, useState } from 'react'
import { AudioControls } from './LessonParts.jsx'
export default function ToeicStimulus({
  source,
  question,
  showText,
  onReveal,
  exam,
  audio
}) {
  const [photoStatus, setPhotoStatus] = useState('loading')
  useEffect(() => {
    if (!source.photo) return
    let active = true
    setPhotoStatus('loading')
    const img = new Image()
    img.onload = () => {
      if (active) setPhotoStatus('ready')
    }
    img.onerror = () => {
      if (active) setPhotoStatus('error')
    }
    img.src = source.photo.url
    return () => {
      active = false
    }
  }, [source.id])
  const listening = ['p1', 'p2', 'p3', 'p4'].includes(source.part)
  const script =
    source.part === 'p1'
      ? question.choices.map((choice, i) => ({ en: `${'ABCD'[i]}. ${choice}` }))
      : source.part === 'p2'
        ? [
            { en: source.transcript },
            ...question.choices.map((choice, i) => ({
              en: `${'ABC'[i]}. ${choice}`
            }))
          ]
        : source.transcript
            ?.split('\n')
            .map((row) => ({
              en: row.replace(/^[MW]:\s*/, ''),
              speaker: row.startsWith('M:') ? 'Alex' : 'Sam'
            })) || []
  return (
    <section className="exam-stimulus" aria-label="問題の素材">
      {source.photo && (
        <figure>
          <div
            className="exam-photo"
            role="img"
            aria-label={source.photo.alt}
            style={{
              backgroundImage: `url(${source.photo.url})`,
              backgroundSize: '600% 300%',
              backgroundPosition: `${(source.photo.index % 6) * 20}% ${Math.floor(source.photo.index / 6) * 50}%`
            }}
          />
          {photoStatus === 'error' && (
            <p role="alert">
              画像を取得できませんでした。通信を確認して再度開いてください。
            </p>
          )}
          <figcaption>学習用に生成した写真</figcaption>
        </figure>
      )}
      {listening && (
        <>
          <AudioControls audio={audio} lines={script} />
          {!exam && (
            <button className="lesson-secondary" onClick={onReveal}>
              {showText
                ? '文字を隠す'
                : '文字で練習する（ヒント使用として記録）'}
            </button>
          )}
          {showText && (
            <div className="exam-transcript">
              <p className="en">{source.transcript}</p>
              <p>{source.translation}</p>
            </div>
          )}
        </>
      )}
      {source.documents && (
        <div
          className={`exam-documents ${source.documents.length > 1 ? 'multiple-documents' : ''}`}
        >
          {source.documents.map((doc, i) => (
            <article key={i} className="exam-document">
              <h3>{doc.title}</h3>
              <div className="en">{doc.body}</div>
              {showText && !exam && (
                <p className="document-translation">{doc.translation}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
