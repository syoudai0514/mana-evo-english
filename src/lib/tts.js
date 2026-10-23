// iOS 標準の英語音声で読み上げる。相棒ごとに声の高さと速さを変える。

const FEMALE = ['Samantha', 'Karen', 'Moira', 'Tessa', 'Victoria', 'Google US English', 'Microsoft Aria']
const MALE = ['Daniel', 'Aaron', 'Fred', 'Alex', 'Arthur', 'Google UK English Male', 'Microsoft Guy']

let unlocked = false

function englishVoices() {
  const synth = window.speechSynthesis
  return synth ? synth.getVoices().filter((voice) => /^en[-_]/i.test(voice.lang)) : []
}

function pickVoice(gender) {
  const voices = englishVoices()
  const names = gender === 'male' ? MALE : FEMALE
  for (const name of names) {
    const hit = voices.find((voice) => voice.name.includes(name))
    if (hit) return hit
  }
  return voices.find((voice) => /en-US/i.test(voice.lang)) || voices[0] || null
}

// iOS はタップの中で一度しゃべらせないと、後からの読み上げが鳴らない
export function unlockSpeech() {
  if (unlocked || !window.speechSynthesis) return
  const utterance = new SpeechSynthesisUtterance(' ')
  utterance.volume = 0
  window.speechSynthesis.speak(utterance)
  unlocked = true
}

export function stopSpeech() {
  window.speechSynthesis?.cancel()
}

export function speak(text, { pitch = 1, rate = 0.9, gender = 'female', lang = 'en-US' } = {}) {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis
    if (!synth || !text) return resolve({completed:false,reason:'unavailable'})
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = lang.startsWith('en') ? pickVoice(gender) : null
    if (voice) utterance.voice = voice
    utterance.lang = voice?.lang || lang
    utterance.pitch = pitch
    utterance.rate = rate
    // onend が来ない端末でも止まらないよう、文の長さから上限時間を決める
    const timer = setTimeout(()=>resolve({completed:false,reason:'timeout'}), 2500 + text.length * 120 / rate)
    utterance.onend = () => { clearTimeout(timer); resolve({completed:true}) }
    utterance.onerror = () => { clearTimeout(timer); resolve({completed:false,reason:'error'}) }
    synth.speak(utterance)
  })
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {}
}
