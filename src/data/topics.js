// おしゃべりモードの「話題の種」。相棒が自分の出来事から話しかけて、あとはAIが自然に広げる。
// opener はホーム画面にすぐ出せるよう、AIを呼ばずに表示する最初のひとこと。
// months を持つ種はその月だけ出る（季節の話題）。

export const TOPICS = [
  { id: 'pumpkin', emoji: '🎃', title: 'かぼちゃの はなし', months: [10], about: 'Halloween, pumpkins, costumes, what the child wants to be', opener: { en: 'Guess what? I found a big pumpkin!', kana: 'ゲス ワット？ アイ ファウンド ア ビッグ パンプキン！', ja: 'ねえきいて！おおきな かぼちゃを みつけたよ！' } },
  { id: 'costume', emoji: '👻', title: 'ハロウィンの へんそう', months: [10], about: 'Halloween costumes, trick or treat, sweets', opener: { en: 'Boo! Did I scare you? I am a ghost today!', kana: 'ブー！ ディド アイ スケア ユー？ アイ アム ア ゴースト トゥデイ！', ja: 'ばあ！びっくりした？きょうは おばけだよ！' } },
  { id: 'leaves', emoji: '🍁', title: 'あきの はっぱ', months: [10, 11], about: 'autumn leaves, colors, going outside, acorns', opener: { en: 'Look! The leaves are red and yellow!', kana: 'ルック！ ザ リーヴズ アー レッド アンド イエロー！', ja: 'みて！はっぱが あかと きいろだよ！' } },
  { id: 'snow', emoji: '⛄', title: 'ゆきの はなし', months: [12, 1, 2], about: 'snow, cold weather, snowman, warm clothes', opener: { en: 'Brrr! It is so cold today!', kana: 'ブルル！ イット イズ ソー コールド トゥデイ！', ja: 'ぶるる！きょうは とっても さむいね！' } },
  { id: 'christmas', emoji: '🎄', title: 'クリスマス', months: [12], about: 'Christmas, presents, Santa, what the child wants', opener: { en: 'Santa is coming soon! What do you want?', kana: 'サンタ イズ カミング スーン！ ワット ドゥ ユー ウォント？', ja: 'もうすぐ サンタさんが くるね！なにが ほしい？' } },
  { id: 'newyear', emoji: '🎍', title: 'おしょうがつ', months: [1], about: 'New Year, family, food, wishes for the year', opener: { en: 'Happy New Year! I ate so much mochi!', kana: 'ハッピー ニュー イヤー！ アイ エイト ソー マッチ モチ！', ja: 'あけまして おめでとう！おもち たくさん たべたよ！' } },
  { id: 'sakura', emoji: '🌸', title: 'さくら', months: [3, 4], about: 'spring, flowers, picnic, new school year', opener: { en: 'The flowers are so pretty! Pink, pink, pink!', kana: 'ザ フラワーズ アー ソー プリティ！ ピンク、ピンク、ピンク！', ja: 'おはなが とっても きれい！ピンク ピンク ピンク！' } },
  { id: 'rain', emoji: '☔', title: 'あめの ひ', months: [6], about: 'rainy days, umbrellas, puddles, frogs', opener: { en: 'Splash! I jumped in a big puddle!', kana: 'スプラッシュ！ アイ ジャンプト イン ア ビッグ パドル！', ja: 'ばしゃーん！おおきな みずたまりに とびこんだよ！' } },
  { id: 'summer', emoji: '🍉', title: 'なつの はなし', months: [7, 8], about: 'summer, watermelon, pool, ice cream, bugs', opener: { en: 'It is so hot! I want ice cream!', kana: 'イット イズ ソー ホット！ アイ ウォント アイス クリーム！', ja: 'あつーい！アイス たべたい！' } },

  { id: 'breakfast', emoji: '🍳', title: 'あさごはん', about: 'breakfast, favorite food, what the child ate today', opener: { en: 'Good morning! I had pancakes today!', kana: 'グッド モーニング！ アイ ハド パンケイクス トゥデイ！', ja: 'おはよう！きょうは パンケーキ たべたよ！' } },
  { id: 'snack', emoji: '🍪', title: 'おやつ', about: 'snacks, sweets, sharing, favorite treats', opener: { en: 'Yum! I have cookies. Do you like cookies?', kana: 'ヤム！ アイ ハヴ クッキーズ。 ドゥ ユー ライク クッキーズ？', ja: 'おいしい！クッキー あるよ。クッキー すき？' } },
  { id: 'animals', emoji: '🐶', title: 'どうぶつ', about: 'animals, pets, animal sounds, the zoo', opener: { en: 'I saw a puppy! Woof woof!', kana: 'アイ ソー ア パピー！ ウーフ ウーフ！', ja: 'こいぬを みたよ！わんわん！' } },
  { id: 'dinosaur', emoji: '🦖', title: 'きょうりゅう', about: 'dinosaurs, big and small, roaring, favorite dinosaur', opener: { en: 'Roar! I am a T-rex! Are you scared?', kana: 'ロアー！ アイ アム ア ティーレックス！ アー ユー スケアード？', ja: 'がおー！ティラノサウルスだぞ！こわい？' } },
  { id: 'colors', emoji: '🌈', title: 'いろ', about: 'colors, favorite color, things of each color', opener: { en: 'I saw a rainbow! What is your favorite color?', kana: 'アイ ソー ア レインボー！ ワット イズ ユア フェイヴァリット カラー？', ja: 'にじを みたよ！すきな いろは なに？' } },
  { id: 'park', emoji: '🛝', title: 'こうえん', about: 'the park, slides, swings, playing outside, friends', opener: { en: 'Let\'s go to the park! I love the slide!', kana: 'レッツ ゴー トゥ ザ パーク！ アイ ラヴ ザ スライド！', ja: 'こうえん いこう！すべりだい だいすき！' } },
  { id: 'cars', emoji: '🚒', title: 'のりもの', about: 'cars, trains, fire trucks, planes, going places', opener: { en: 'Nee-noo! A big red fire truck went by!', kana: 'ニーノー！ ア ビッグ レッド ファイア トラック ウェント バイ！', ja: 'ウーウー！おおきな あかい しょうぼうしゃが とおったよ！' } },
  { id: 'today', emoji: '☀️', title: 'きょう なにした？', about: 'what the child did today, kindergarten, play time, feelings', opener: { en: 'Hi! I had a fun day. How about you?', kana: 'ハイ！ アイ ハド ア ファン デイ。 ハウ アバウト ユー？', ja: 'やあ！たのしい いちにち だったよ。きみは？' } },
  { id: 'feelings', emoji: '😊', title: 'きもち', about: 'feelings: happy, sleepy, hungry, tired, excited', opener: { en: 'I am so happy today! How are you?', kana: 'アイ アム ソー ハッピー トゥデイ！ ハウ アー ユー？', ja: 'きょうは とっても うれしいの！げんき？' } },
  { id: 'family', emoji: '🏠', title: 'おうち', about: 'home, family members, toys, what they do together (no addresses or real names needed)', opener: { en: 'I built a pillow house! Do you have a favorite toy?', kana: 'アイ ビルト ア ピロウ ハウス！ ドゥ ユー ハヴ ア フェイヴァリット トイ？', ja: 'まくらで おうちを つくったよ！すきな おもちゃ ある？' } },
  { id: 'monsters', emoji: '🐉', title: 'モンスター', about: 'monsters, superpowers, what power the child wants, ManaEvo monsters', opener: { en: 'If you had a superpower, what would it be?', kana: 'イフ ユー ハド ア スーパーパワー、 ワット ウッド イット ビー？', ja: 'もし ちょうのうりょくが あったら なにが いい？' } },
  { id: 'bugs', emoji: '🐞', title: 'むし', about: 'bugs, ladybugs, beetles, catching bugs', opener: { en: 'A ladybug is on my nose! Look!', kana: 'ア レイディバグ イズ オン マイ ノーズ！ ルック！', ja: 'てんとうむしが はなに のってる！みて！' } },
  { id: 'sea', emoji: '🐳', title: 'うみ', about: 'the sea, fish, whales, swimming, the beach', opener: { en: 'I swam with a whale! It was sooo big!', kana: 'アイ スワム ウィズ ア ホエール！ イット ワズ スーー ビッグ！', ja: 'くじらと およいだよ！すっごく おおきかった！' } },
  { id: 'space', emoji: '🚀', title: 'うちゅう', about: 'space, rockets, the moon, stars, aliens', opener: { en: 'I want to fly to the moon! Do you want to come?', kana: 'アイ ウォント トゥ フライ トゥ ザ ムーン！ ドゥ ユー ウォント トゥ カム？', ja: 'つきまで とんで いきたい！いっしょに いく？' } },
  { id: 'sports', emoji: '⚽', title: 'スポーツ', about: 'sports, running, soccer, swimming, what the child is good at', opener: { en: 'I kicked a ball so high! Do you like soccer?', kana: 'アイ キックト ア ボール ソー ハイ！ ドゥ ユー ライク サッカー？', ja: 'ボールを すっごく たかく けったよ！サッカー すき？' } },
  { id: 'music', emoji: '🎵', title: 'うた', about: 'songs, singing, dancing, instruments', opener: { en: 'La la la! I love singing. Do you like to sing?', kana: 'ラ ラ ラ！ アイ ラヴ シンギング。 ドゥ ユー ライク トゥ シング？', ja: 'ららら！うたうの だいすき。うたうの すき？' } },
  { id: 'sleepy', emoji: '😴', title: 'ねむい', about: 'sleep, dreams, bedtime, favorite pajamas', opener: { en: 'Yawn... I had a funny dream last night!', kana: 'ヨーン… アイ ハド ア ファニー ドリーム ラスト ナイト！', ja: 'ふわぁ… きのう おもしろい ゆめを みたよ！' } },
  { id: 'cooking', emoji: '🍕', title: 'りょうり', about: 'cooking, pizza, making food, favorite dinner', opener: { en: 'I am making pizza! What should I put on it?', kana: 'アイ アム メイキング ピッツァ！ ワット シュッド アイ プット オン イット？', ja: 'ピザを つくってるの！なにを のせたら いい？' } },
  { id: 'treasure', emoji: '💎', title: 'たからさがし', about: 'treasure hunt, finding things, shapes and colors of treasure', opener: { en: 'I found a shiny treasure box! What is inside?', kana: 'アイ ファウンド ア シャイニー トレジャー ボックス！ ワット イズ インサイド？', ja: 'ぴかぴかの たからばこを みつけた！なかに なにが あるかな？' } },
  { id: 'weather', emoji: '🌤️', title: 'おてんき', about: 'the weather today, sunny, cloudy, windy, what to wear', opener: { en: 'Look outside! Is it sunny or rainy today?', kana: 'ルック アウトサイド！ イズ イット サニー オア レイニー トゥデイ？', ja: 'おそと みて！きょうは はれ？あめ？' } }
]

function currentMonth(date) {
  return date.getMonth() + 1
}

export function topicsForDate(date = new Date()) {
  const month = currentMonth(date)
  return TOPICS.filter((topic) => !topic.months || topic.months.includes(month))
}

// 季節の話題を少し優先しつつ、最近使った話題は避けて選ぶ
export function pickTopic({ date = new Date(), recentIds = [], random = Math.random } = {}) {
  const month = currentMonth(date)
  const candidates = topicsForDate(date).filter((topic) => !recentIds.includes(topic.id))
  const pool = candidates.length ? candidates : topicsForDate(date)
  const weighted = pool.flatMap((topic) => (topic.months?.includes(month) ? [topic, topic, topic] : [topic]))
  return weighted[Math.floor(random() * weighted.length)]
}

export function topicById(id) {
  return TOPICS.find((topic) => topic.id === id) || null
}
