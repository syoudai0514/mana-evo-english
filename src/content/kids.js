import seeds from './kids-seeds.json' with { type: 'json' }
import { line, metadata } from './shared.js'
export const KID_ACTIVITIES = seeds.map((seed, index) => {
  const phrases = [line(`Look at ${seed.object}.`, `${seed.objectJa}を みて。`), line(seed.description, seed.descriptionJa), line(`Can you see ${seed.object}?`, `${seed.objectJa}が みえる？`), line(`Let's ${seed.action}.`, seed.actionJa), line('We did it together!', 'いっしょに できたね！')].map((phrase, i) => ({ ...phrase, id: `${seed.id}.phrase.${i + 1}` }))
  const other = seeds.filter(item => item.id !== seed.id && item.object !== seed.object)
  return { ...seed, ...metadata(seed.id, 'kids-activity', seed.title, 'Pre-A1', 3), mode: index % 3 === 0 ? 'play' : index % 3 === 1 ? 'guess' : 'free', goals: [`${seed.objectJa}の えいごを きく`, 'ひとこと えらぶ・いう', seed.actionJa], phrases, opener: line(`Hello! Let's ${seed.action}.`, `こんにちは！${seed.actionJa}`), rescue: ['にほんごでも だいじょうぶ。いっしょに きこう。', 'ゆびで えらぶだけでも いいよ。'], steps: [
    { prompt: `Which one is ${seed.object}?`, ja: `${seed.objectJa}は どれかな？`, choices: [line(seed.object,seed.objectJa,{emoji:seed.emoji}), ...other.slice(index % 20, index % 20 + 2).map(item=>line(item.object,item.objectJa,{emoji:item.emoji}))], answer: 0, goal: 'identify' },
    { prompt: seed.description, ja: 'どんな いみかな？', choices: [line(seed.description,seed.descriptionJa), ...other.filter(item=>item.description !== seed.description).slice(0,2).map(item=>line(item.description,item.descriptionJa))], answer: 0, goal: 'understand' },
    { prompt: `Let's ${seed.action}.`, ja: seed.actionJa, choices: [line('Let’s do it!', 'やってみよう！'), line('Listen with me.', 'いっしょに きこう。'), line('Help me, please.', 'てつだってね。')], answer: null, goal: 'respond' }
  ], partnerNotes: { howamy: 'Speak gently. Praise effort and allow silence.', niji: 'Be a cheerful explorer. Use playful sounds without pressure.' } }
})
export const KID_WORLDS = [...new Set(seeds.map(item => item.world))].map(id => ({ id, label: seeds.find(item=>item.world===id).worldLabel, emoji:seeds.find(item=>item.world===id).worldEmoji }))
