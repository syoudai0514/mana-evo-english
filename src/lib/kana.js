// カタカナの読みをひらがなに変える（長音「ー」や記号はそのまま）
export function toHiragana(text) {
  return String(text || '').replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

export const READING_ORDER = ['hira', 'kata', 'none']

export function nextReading(mode) {
  const index = READING_ORDER.indexOf(mode)
  return READING_ORDER[(index + 1) % READING_ORDER.length]
}

export function readingText(kana, mode) {
  if (mode === 'none' || !kana) return ''
  return mode === 'hira' ? toHiragana(kana) : kana
}
