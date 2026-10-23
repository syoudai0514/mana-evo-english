import React from 'react'
export default function TalkVoiceControls({
  autoVoice,
  toggleVoice,
  voiceError
}) {
  return (
    <div className="talk-voice-controls">
      <button
        type="button"
        className="talk-voice-toggle"
        aria-label={
          autoVoice ? '相棒の音声をOFFにする' : '相棒の音声をONにする'
        }
        aria-pressed={autoVoice}
        onClick={toggleVoice}
      >
        {autoVoice
          ? '🔊 あいぼうの こえ ON'
          : '🔇 あいぼうの こえ OFF・タップでON'}
      </button>
      {!autoVoice && (
        <span>
          おうちのひとが よむモード。🔊を おすと そのセリフを きけるよ。
        </span>
      )}
      {voiceError && <span role="status">{voiceError}</span>}
    </div>
  )
}
