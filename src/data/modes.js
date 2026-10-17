// モード一覧。ホームのカード表示と、会話指示に入るモード別ルールを持つ。
// 新しいモードはここに1つ足し、prompt.js の modeRules に指示を足せばよい。

export const MODES = {
  free: { id: 'free', emoji: '🎤', title: 'おしゃべり', titleEn: 'Free Talk', status: 'ready', maxTurns: 10 },
  play: { id: 'play', emoji: '🎭', title: 'ごっこあそび', titleEn: 'Pretend Play', status: 'ready', maxTurns: 10, iconBg: '#FFF1C9' },
  guess: { id: 'guess', emoji: '🔍', title: 'あてっこゲーム', titleEn: 'Guess Who?', status: 'ready', maxTurns: 12, iconBg: '#E9FBE9' },
  story: { id: 'story', emoji: '📖', title: 'おはなしづくり', titleEn: 'Story Time', status: 'soon', maxTurns: 10, iconBg: '#FFE3EF' },
  world: { id: 'world', emoji: '📞', title: 'せかいのともだち', titleEn: 'Video Call', status: 'locked', maxTurns: 10, iconBg: '#DDF0FF' },
  parentChild: { id: 'parentChild', emoji: '👨‍👦', title: '親子モード', titleEn: 'Together', status: 'ready', maxTurns: 10 },
  adult: { id: 'adult', emoji: '🧑', title: '大人の練習', titleEn: 'Adult Practice', status: 'ready', maxTurns: 16 }
}

export const HOME_MODE_IDS = ['play', 'world', 'guess', 'story']

// 大人の練習の場面
export const ADULT_SCENES = [
  { id: 'kid', emoji: '🧒', title: '子どもへの声かけ', about: 'everyday English a parent can say to a young child at home (morning routine, bath, bedtime, praise)', opener: 'Good morning! Let\'s practice things you can say to your child. What time does your day usually start?' },
  { id: 'smalltalk', emoji: '☕', title: '雑談', about: 'casual small talk with a friendly foreign neighbor or parent at the park', opener: 'Hi there! Nice weather today, isn\'t it? Do you come to this park often?' },
  { id: 'travel', emoji: '🧳', title: '旅行', about: 'travel situations: hotel check-in, ordering at a restaurant, asking for directions', opener: 'Welcome to our hotel! Do you have a reservation?' },
  { id: 'work', emoji: '💼', title: '仕事', about: 'simple workplace English: introductions, meetings, email phrases', opener: 'Hi, nice to meet you! I\'m Alex from the London office. What do you do?' },
  { id: 'restaurant', emoji: '🍝', title: 'レストラン', about: 'ordering food, asking about the menu, paying', opener: 'Good evening! Here is the menu. Can I get you something to drink first?' }
]
