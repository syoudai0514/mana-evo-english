import replies from './conversation-replies.json' with { type: 'json' }
import seeds from './conversation-seeds.json' with { type: 'json' }
import { line, metadata, LEVELS } from './shared.js'
export const CONVERSATION_CATEGORIES = [
  ...new Set(seeds.map((item) => item.category))
].map((id) => ({
  id,
  label: seeds.find((item) => item.category === id).categoryLabel,
  emoji: seeds.find((item) => item.category === id).emoji
}))
const REPAIRS = {
  A1: [
    line('Could you say that again, please?', 'もう一度言ってもらえますか？'),
    line('Thank you. That helps.', 'ありがとう。助かります。')
  ],
  A2: [
    line(
      'Could you explain what you mean?',
      'どういう意味か説明してもらえますか？'
    ),
    line('Let me check that I understood.', '理解できたか確認させてください。')
  ],
  B1: [
    line(
      'If that is not possible, what would you recommend?',
      'もしそれが難しければ、何を勧めますか？'
    ),
    line(
      'That makes sense. Let me explain my situation.',
      'なるほど。私の状況を説明させてください。'
    )
  ]
}
export const CONVERSATION_LESSONS = seeds.flatMap((seed, sceneIndex) =>
  LEVELS.map((level, index) => ({
    ...metadata(
      `${seed.id}.${level.toLowerCase()}`,
      'conversation',
      seed.title,
      level,
      4 + index * 2
    ),
    category: seed.category,
    categoryLabel: seed.categoryLabel,
    emoji: seed.emoji,
    sceneId: seed.id,
    goals: [
      `${seed.title}の場面で用件を伝える`,
      index === 0
        ? '短い表現で応答する'
        : index === 1
          ? '聞き返して内容を確認する'
          : '代案を示して会話を続ける',
      '自分の状況に置き換えて一文を言う'
    ],
    phrases: seed.phrases.map((p, i) => ({
      ...p,
      id: `${seed.id}.phrase.${i + 1}`
    })),
    dialogue: [
      { ...seed.phrases[0], speaker: 'learner' },
      { ...seed.phrases[1], speaker: 'partner' },
      { ...seed.phrases[2], speaker: 'learner' },
      line(...replies[sceneIndex], { speaker: 'partner' }),
      {
        ...(level === 'B1'
          ? line(
              'Could you clarify what you mean?',
              '意味をもう少し説明してもらえますか？'
            )
          : REPAIRS[level][0]),
        speaker: 'learner'
      },
      line(
        `Of course. ${replies[sceneIndex][0]}`,
        `もちろんです。${replies[sceneIndex][1]}`,
        { speaker: 'partner' }
      ),
      ...(index > 0
        ? [
            line(
              index === 1
                ? 'Let me check that I understood.'
                : 'Could we think about another option?',
              index === 1
                ? '理解できたか確認させてください。'
                : '別の選択肢も考えられますか？',
              { speaker: 'learner' }
            ),
            line(
              index === 1
                ? 'Of course. What would you like to check?'
                : 'Sure. What would work better for you?',
              index === 1
                ? 'もちろんです。何を確認したいですか？'
                : 'もちろん。あなたには何がより都合がよいですか？',
              { speaker: 'partner' }
            )
          ]
        : [])
    ],
    questions: [
      {
        en: 'What would you say in this situation?',
        ja: 'この状況なら何と言いますか？'
      },
      {
        en: 'What would you change for your own situation?',
        ja: 'あなたの状況に合わせるなら何を変えますか？'
      },
      {
        en:
          index === 2
            ? 'What could you do if the first plan does not work?'
            : 'How could you ask for help?',
        ja:
          index === 2
            ? '最初の案がうまくいかないときはどうしますか？'
            : 'どうやって助けを求めますか？'
      }
    ],
    repairPhrases: REPAIRS[level],
    recasts: [line(seed.phrases[0].en, seed.phrases[0].ja), ...REPAIRS[level]],
    reviewPhrases: [...seed.phrases, ...REPAIRS[level]],
    reply: line(...replies[sceneIndex]),
    about: `Guided role-play: ${seed.title}. Practice ${seed.phrases[0].en} You are the other speaker, not the learner. Let the learner start. Then ask one follow-up. ${level === 'A1' ? 'Use very short sentences and offer choices.' : level === 'A2' ? 'Ask for details and clarification.' : 'Ask for reasons and negotiate an alternative.'}`
  }))
)
export { seeds as CONVERSATION_SCENES }
