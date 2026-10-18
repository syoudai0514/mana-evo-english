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

// 画面カードのヒントの絵文字。壊れた文字（�）は捨て、番号（emoji_code）から作りなおす。どちらもだめなら出さない
const PICTO = /\p{Extended_Pictographic}/u
export function cleanEmoji(emoji, code) {
  const text = String(emoji || '')
  if (text && !text.includes('�') && PICTO.test(text)) return text
  const points = String(code || '').toUpperCase().match(/[0-9A-F]{4,6}/g) || []
  try {
    const made = String.fromCodePoint(...points.map((hex) => parseInt(hex, 16)))
    if (PICTO.test(made)) return made
  } catch {}
  return ''
}

export function cleanHint(hint) {
  return { ...hint, emoji: cleanEmoji(hint?.emoji, hint?.emoji_code) }
}

// 子ども向けの日本語：句読点や！？の前の空白を詰める（「マサキ 。」→「マサキ。」）
export function tidyKidsJa(text) {
  return String(text || '').replace(/\s+([。、！？!?）」])/g, '$1').replace(/([「（])\s+/g, '$1').trim()
}
