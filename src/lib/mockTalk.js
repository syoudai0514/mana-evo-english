// 画面確認用のダミー相手（?mock=1）。AIは使わない。
const LINES = [
  { en: 'Wow, that sounds fun! What color is it?', kana: 'ワオ、 ザット サウンズ ファン！ ワット カラー イズ イット？', ja: 'わあ、たのしそう！それは なにいろ？', hints: [['red', 'レッド', '🔴'], ['blue', 'ブルー', '🔵'], ['yellow', 'イエロー', '🟡']] },
  { en: 'I like that too! Do you like dogs or cats?', kana: 'アイ ライク ザット トゥー！ ドゥ ユー ライク ドッグズ オア キャッツ？', ja: 'ぼくも それ すき！いぬと ねこ どっちが すき？', hints: [['dogs', 'ドッグズ', '🐶'], ['cats', 'キャッツ', '🐱']] },
  { en: 'Me too! What do you want to be?', kana: 'ミー トゥー！ ワット ドゥ ユー ウォント トゥ ビー？', ja: 'ぼくも！なにに なりたい？', hints: [['a ghost', 'ア ゴースト', '👻'], ['a wizard', 'ア ウィザード', '🧙'], ['a dinosaur', 'ア ダイナソー', '🦖']] },
  { en: 'Roar! That is so cool! Is it big or small?', kana: 'ロアー！ ザット イズ ソー クール！ イズ イット ビッグ オア スモール？', ja: 'がおー！かっこいい！おおきい？ちいさい？', hints: [['big', 'ビッグ', '🦕'], ['small', 'スモール', '🐣']] }
]

let step = 0

export async function mockReply({ input, context }) {
  await new Promise((resolve) => setTimeout(resolve, 600))
  const turn = context?.turn || 1
  const childText = input.text ? input.text.replace(/^\[HINT\]\s*/, '') : (input.audio ? 'Yes!' : '')
  const isStart = input.text === '[START]'
  const english = /[a-z]/i.test(childText)
  const line = LINES[step++ % LINES.length]
  const end = !isStart && turn >= (context?.maxTurns || 6)
  return {
    model: 'mock',
    modelIndex: 0,
    reply: {
      child_said: isStart ? '' : childText,
      heard: true,
      child_lang: english ? 'en' : 'ja',
      spoke_english: english,
      recast: english ? '' : 'I like it.',
      reply_en: end ? 'That was so fun! See you tomorrow!' : (isStart ? 'Hello! Welcome! What would you like?' : line.en),
      reply_kana: end ? 'ザット ワズ ソー ファン！ シー ユー トゥモロー！' : (isStart ? 'ハロー！ ウェルカム！ ワット ウッド ユー ライク？' : line.kana),
      reply_ipa: '',
      reply_ja: end ? 'とっても たのしかった！また あした！' : (isStart ? 'いらっしゃい！なにに しますか？' : line.ja),
      hints: end ? [] : line.hints.map(([en, kana, emoji]) => ({ en, kana, emoji })),
      memory: turn === 2 ? ['likes dinosaurs'] : [],
      tip_ja: context?.mode === 'adult' ? '「I want to」は「I\'d like to」にするとていねいです。' : '',
      end
    }
  }
}
