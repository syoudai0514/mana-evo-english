import React from 'react'
import { micSupported } from '../../lib/recorder.js'
function keysWanted() {
  try {
    return localStorage.getItem('mee-keys') === '1'
  } catch {
    return false
  }
}
export default function TalkDock({
  typing,
  submitText,
  text,
  setText,
  adult,
  busy,
  dontKnow,
  recording,
  pressed,
  engine,
  startRecording,
  stopRecording,
  micLevel,
  setTyping,
  caption,
  persona
}) {
  return (
    <div className="dock">
      {typing && (
        <form
          className="text-input"
          onSubmit={submitText}
          style={{ marginBottom: 12 }}
        >
          <input
            aria-label={adult ? '会話への入力' : 'えいごで かく'}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              adult ? 'Type in English (日本語でもOK)' : 'えいごで かいてね'
            }
            enterKeyHint="send"
          />
          <button type="submit" className="press" disabled={busy}>
            おくる
          </button>
        </form>
      )}
      <div className="dock-row">
        <button className="side-btn" disabled={busy} onClick={dontKnow}>
          🤔
          <br />
          わから
          <br />
          ない
        </button>
        <button
          type="button"
          className={`mic ${recording || pressed ? 'rec' : ''} ${busy ? 'busy' : ''} ${engine === 'connecting' && !adult ? 'sleep' : ''}`}
          onPointerDown={startRecording}
          onPointerUp={stopRecording}
          onPointerCancel={stopRecording}
          onPointerLeave={stopRecording}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if ((event.key === ' ' || event.key === 'Enter') && !event.repeat)
              startRecording(event)
          }}
          onKeyUp={(event) => {
            if (event.key === ' ' || event.key === 'Enter') stopRecording(event)
          }}
          onBlur={stopRecording}
          aria-pressed={recording || pressed}
          aria-label="おしながら はなす"
        >
          <div
            className="ring"
            style={{ inset: -14, transform: `scale(${1 + micLevel * 0.35})` }}
          />
          <div
            className="ring"
            style={{ inset: -6, background: 'rgba(255,107,91,.22)' }}
          />
          <div className="core">
            {engine === 'connecting' && !adult ? '💤' : busy ? '💭' : '🎤'}
          </div>
        </button>
        {/* 子どもは文字を打てないので、マイクが使えるときは もじ を出さない */}
        {adult || !micSupported() || keysWanted() ? (
          <button className="side-btn" onClick={() => setTyping((v) => !v)}>
            ⌨️
            <br />
            もじ
          </button>
        ) : (
          <div style={{ width: 54 }} />
        )}
      </div>
      <div className="cap">
        {caption ||
          (adult
            ? engine === 'connecting'
              ? `${persona.name}につないでいます…`
              : busy
                ? `${persona.name}が考え中…`
                : recording
                  ? '聞いています…（離すと送信）'
                  : '押しながら話してください'
            : engine === 'connecting'
              ? `${persona.name}が おきるまで まってね…`
              : busy
                ? `${persona.name}が かんがえてるよ…`
                : recording
                  ? 'きいてるよ… はなしおわったら ゆびを はなしてね'
                  : pressed
                    ? 'ちょっと まってね…'
                    : 'ぎゅーっと おしながら はなしてね')}
      </div>
    </div>
  )
}
