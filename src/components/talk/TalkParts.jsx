import React from 'react'
import { Reading } from '../ui.jsx'
export function Avatar({ persona, className = '', size }) {
  if (persona.image)
    return (
      <img
        src={persona.image}
        onError={(event) => {
          event.currentTarget.onerror = null
          event.currentTarget.src = '/monsters/m049.webp'
        }}
        alt=""
        className={className}
        style={
          size ? { width: size, height: size, objectFit: 'contain' } : undefined
        }
      />
    )
  return (
    <div
      className={`avatar ${className}`}
      style={
        size ? { width: size, height: size, fontSize: size * 0.55 } : undefined
      }
    >
      {persona.emoji}
    </div>
  )
}

// 子どもの言葉を言い直した部分に、うすくマーカーを引く
function Highlight({ text, mark }) {
  if (!mark) return text
  const core = mark
    .replace(/^I\s+/i, '')
    .replace(/[.!?]$/, '')
    .trim()
  if (core.length < 3) return text
  const index = text.toLowerCase().indexOf(core.toLowerCase())
  if (index < 0) return text
  return (
    <>
      {text.slice(0, index)}
      <span className="mark">{text.slice(index, index + core.length)}</span>
      {text.slice(index + core.length)}
    </>
  )
}

export function TalkTranscript({
  config,
  persona,
  turns,
  talkingIndex,
  latestPartnerIndex,
  readingPolicy,
  state,
  cycleReading,
  showJa,
  adult,
  live,
  speakJapanese,
  replay,
  busy,
  logRef
}) {
  return (
    <div className="talk-log" ref={logRef}>
      {config.parentReads && (
        <div className="center">
          <span
            className="tag"
            style={{
              background: '#fff',
              color: 'var(--grape)',
              fontSize: 12,
              padding: '5px 12px'
            }}
          >
            👨‍👦 おうちのひとが {persona.name}の セリフを よんでね
          </span>
        </div>
      )}
      {turns.map((turn, index) =>
        turn.who === 'partner' ? (
          <div key={index}>
            <div className="row-partner">
              <Avatar
                persona={persona}
                className={
                  talkingIndex === index ||
                  (talkingIndex === 'latest' && index === latestPartnerIndex)
                    ? 'monster-talk'
                    : ''
                }
              />
              <div
                className={`bubble ${index === latestPartnerIndex ? 'latest' : ''}`}
              >
                <div
                  className="say"
                  style={config.parentReads ? { fontSize: 21 } : undefined}
                >
                  <Highlight text={turn.text} mark={turns[index - 1]?.recast} />
                </div>
                <Reading
                  kana={turn.kana}
                  ipa={turn.ipa}
                  policy={readingPolicy}
                  mode={state.reading}
                  onCycle={cycleReading}
                />
                {showJa && (adult ? turn.ja : turn.jaKids || turn.ja) && (
                  <div className={adult ? 'ja' : 'ja kids'}>
                    {adult ? turn.ja : turn.jaKids || turn.ja}
                    {/* ひらがなが まだ読みにくい子のために、意味を声でも */}
                    {!adult && (
                      <button
                        className="ja-speak"
                        aria-label="にほんごで きく"
                        onClick={() => {
                          live.current?.player?.stop()
                          speakJapanese(turn.jaKids || turn.ja)
                        }}
                      >
                        🔊 にほんご
                      </button>
                    )}
                  </div>
                )}
                {!turn.live && (
                  <button
                    className="speak"
                    aria-label="もういちど きく"
                    onClick={() => replay(turn, index)}
                  >
                    🔊
                  </button>
                )}
              </div>
            </div>
            {!adult && turn.tip && (
              <div className="tip" style={{ marginTop: 8 }}>
                💡 {turn.tip}
              </div>
            )}
          </div>
        ) : (
          <div key={index} className="row-child">
            <div
              className={`child-bubble ${turn.english ? 'en' : 'ja'}`}
              style={{ opacity: turn.pending ? 0.6 : 1 }}
            >
              {turn.text || '…'}
            </div>
            {!turn.pending && !adult && turn.english && !turn.hint && (
              <span className="tag praise">✨ えいごで いえたね！</span>
            )}
            {!turn.pending && !adult && turn.hint && (
              <span
                className="tag praise"
                style={{ background: '#E9F6FF', color: '#2A84DB' }}
              >
                👆 えらべたね！
              </span>
            )}
            {!turn.pending && turn.recast && (adult || !turn.english) && (
              <span
                className="tag recast en"
                style={{
                  fontSize: 12,
                  whiteSpace: 'normal',
                  textAlign: 'right'
                }}
              >
                💬 {turn.recast}
              </span>
            )}
            {adult && turn.tip && (
              <div className="tip adult-tip">💡 {turn.tip}</div>
            )}
          </div>
        )
      )}
      {busy && (
        <div className="row-partner">
          <Avatar persona={persona} className="monster-float" />
          <div className="bubble" style={{ flex: 'none' }}>
            <span className="typing">
              <i />
              <i />
              <i />
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
export function TalkHints({
  busy,
  latest,
  stopped,
  adult,
  pickedHint,
  tapHint,
  showJa
}) {
  return (
    <>
      {' '}
      {!busy && latest?.hints?.length > 0 && !stopped && (
        <div className="hints">
          <div className="label">
            💡{' '}
            {adult
              ? 'こんな返し方も'
              : 'タップで きこえるよ → もういちど タップで こたえる（こえで いっても OK）'}
          </div>
          <div className="hint-row">
            {latest.hints.map((hint) => (
              <button
                key={hint.en}
                className={`press hint ${pickedHint?.en === hint.en ? 'on' : ''}`}
                onClick={() => tapHint(hint)}
              >
                {pickedHint?.en === hint.en && (
                  <span className="tag send">これで こたえる</span>
                )}
                {hint.emoji && <div className="e">{hint.emoji}</div>}
                <div className="w">{hint.en}</div>
                <div className="k">{hint.kana}</div>
                {!adult && showJa && hint.ja && (
                  <div className="m">{hint.ja}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
