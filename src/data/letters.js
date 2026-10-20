// きょうの もじ：アルファベットを1日1文字。文字の名前・音・絵のことばで覚える（読むより先に、耳と絵で）。
// sound はその文字のはじめの音（フォニックス）。kana は子ども向けの読み（目安）。

export const LETTERS = [
  { letter: 'A', name: 'エー', sound: 'ア', say: 'a', word: 'apple', wordKana: 'アップル', emoji: '🍎', ja: 'りんご' },
  { letter: 'B', name: 'ビー', sound: 'ブ', say: 'b', word: 'ball', wordKana: 'ボール', emoji: '⚽', ja: 'ボール' },
  { letter: 'C', name: 'シー', sound: 'ク', say: 'c', word: 'cat', wordKana: 'キャット', emoji: '🐱', ja: 'ねこ' },
  { letter: 'D', name: 'ディー', sound: 'ドゥ', say: 'd', word: 'dog', wordKana: 'ドッグ', emoji: '🐶', ja: 'いぬ' },
  { letter: 'E', name: 'イー', sound: 'エ', say: 'e', word: 'egg', wordKana: 'エッグ', emoji: '🥚', ja: 'たまご' },
  { letter: 'F', name: 'エフ', sound: 'フ', say: 'f', word: 'fish', wordKana: 'フィッシュ', emoji: '🐟', ja: 'さかな' },
  { letter: 'G', name: 'ジー', sound: 'グ', say: 'g', word: 'goat', wordKana: 'ゴート', emoji: '🐐', ja: 'やぎ' },
  { letter: 'H', name: 'エイチ', sound: 'ハ', say: 'h', word: 'hat', wordKana: 'ハット', emoji: '🎩', ja: 'ぼうし' },
  { letter: 'I', name: 'アイ', sound: 'イ', say: 'i', word: 'insect', wordKana: 'インセクト', emoji: '🐛', ja: 'むし' },
  { letter: 'J', name: 'ジェイ', sound: 'ジュ', say: 'j', word: 'juice', wordKana: 'ジュース', emoji: '🧃', ja: 'ジュース' },
  { letter: 'K', name: 'ケイ', sound: 'ク', say: 'k', word: 'kite', wordKana: 'カイト', emoji: '🪁', ja: 'たこ（たこあげ）' },
  { letter: 'L', name: 'エル', sound: 'ル', say: 'l', word: 'lion', wordKana: 'ライオン', emoji: '🦁', ja: 'ライオン' },
  { letter: 'M', name: 'エム', sound: 'ム', say: 'm', word: 'moon', wordKana: 'ムーン', emoji: '🌙', ja: 'おつきさま' },
  { letter: 'N', name: 'エヌ', sound: 'ン', say: 'n', word: 'nose', wordKana: 'ノーズ', emoji: '👃', ja: 'はな' },
  { letter: 'O', name: 'オー', sound: 'オ', say: 'o', word: 'octopus', wordKana: 'オクトパス', emoji: '🐙', ja: 'たこ' },
  { letter: 'P', name: 'ピー', sound: 'プ', say: 'p', word: 'pig', wordKana: 'ピッグ', emoji: '🐷', ja: 'ぶた' },
  { letter: 'Q', name: 'キュー', sound: 'クウ', say: 'q', word: 'queen', wordKana: 'クイーン', emoji: '👑', ja: 'じょおうさま' },
  { letter: 'R', name: 'アール', sound: 'ゥル', say: 'r', word: 'rabbit', wordKana: 'ラビット', emoji: '🐰', ja: 'うさぎ' },
  { letter: 'S', name: 'エス', sound: 'ス', say: 's', word: 'sun', wordKana: 'サン', emoji: '☀️', ja: 'おひさま' },
  { letter: 'T', name: 'ティー', sound: 'トゥ', say: 't', word: 'tiger', wordKana: 'タイガー', emoji: '🐯', ja: 'とら' },
  { letter: 'U', name: 'ユー', sound: 'ア', say: 'u', word: 'umbrella', wordKana: 'アンブレラ', emoji: '☂️', ja: 'かさ' },
  { letter: 'V', name: 'ヴィー', sound: 'ヴ', say: 'v', word: 'violin', wordKana: 'バイオリン', emoji: '🎻', ja: 'バイオリン' },
  { letter: 'W', name: 'ダブリュー', sound: 'ウ', say: 'w', word: 'whale', wordKana: 'ホエール', emoji: '🐳', ja: 'くじら' },
  { letter: 'X', name: 'エックス', sound: 'クス', say: 'x', word: 'fox', wordKana: 'フォックス', emoji: '🦊', ja: 'きつね（おしりに X）' },
  { letter: 'Y', name: 'ワイ', sound: 'ヤ', say: 'y', word: 'yo-yo', wordKana: 'ヨーヨー', emoji: '🪀', ja: 'ヨーヨー' },
  { letter: 'Z', name: 'ゼッド', sound: 'ズ', say: 'z', word: 'zebra', wordKana: 'ゼブラ', emoji: '🦓', ja: 'しまうま' }
]

// おぼえる順番（Jolly Phonics の順）：s a t p i n で、すぐに sat / pin / tap などのことばが作れる
export const LETTER_ORDER = 'satpinmdgockeurhbfljvwxyzq'.toUpperCase().split('')

export function letterOf(char) {
  return LETTERS.find((item) => item.letter === char) || LETTERS[0]
}
