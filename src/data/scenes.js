// ごっこあそびの場面。場面 × 役割 × ハプニング を毎回組み合わせて、ちがう展開にする。

export const SCENE_CATEGORIES = [
  { id: 'all', label: 'ぜんぶ' },
  { id: 'shop', label: 'おみせ' },
  { id: 'out', label: 'おでかけ' },
  { id: 'home', label: 'おうち' }
]

export const SCENES = [
  {
    id: 'icecream', emoji: '🍦', title: 'アイスやさん', titleEn: 'Ice Cream Shop', category: 'shop',
    colors: ['#FFE3D6', '#FFF6EF', '#F3C9B9', '#E04A3B'],
    roles: [
      { child: 'customer', partner: 'ice cream shop clerk', childJa: 'おきゃくさん' },
      { child: 'ice cream shop clerk', partner: 'customer', childJa: 'てんいんさん' }
    ],
    twists: ['the chocolate flavor is sold out', 'the ice cream starts melting fast', 'a rainbow flavor is the special today', 'the customer wants a super tall 5-scoop cone'],
    phrases: ['Can I have ___, please?', 'Here you are!', 'Thank you!', 'Which flavor?']
  },
  {
    id: 'burger', emoji: '🍔', title: 'バーガーやさん', titleEn: 'Burger Shop', category: 'shop',
    colors: ['#FFF0CC', '#FFFAEE', '#F5D9A8', '#B07A00'],
    roles: [
      { child: 'burger shop clerk', partner: 'hungry customer', childJa: 'てんいんさん' },
      { child: 'customer', partner: 'burger shop clerk', childJa: 'おきゃくさん' }
    ],
    twists: ['the customer is a very hungry dragon', 'the customer wants a burger with strawberries', 'there is a free toy today', 'the fries are extra long today'],
    phrases: ['What would you like?', 'I want a burger.', 'Anything else?', 'Here you go!']
  },
  {
    id: 'fruit', emoji: '🍎', title: 'くだものやさん', titleEn: 'Fruit Stand', category: 'shop',
    colors: ['#E6F8DF', '#F7FDF4', '#C5E6B8', '#3E8E2C'],
    roles: [
      { child: 'fruit seller', partner: 'customer', childJa: 'おみせやさん' },
      { child: 'customer', partner: 'fruit seller', childJa: 'おきゃくさん' }
    ],
    twists: ['a giant watermelon arrives', 'the customer is counting coins and needs help', 'a banana is missing', 'the apples are on sale'],
    phrases: ['How many?', 'One apple, please.', 'How much is it?', 'Yummy!']
  },
  {
    id: 'airport', emoji: '✈️', title: 'くうこう', titleEn: 'At the Airport', category: 'out',
    colors: ['#DCEEFF', '#F4F9FF', '#BFD9F5', '#2A84DB'],
    roles: [
      { child: 'traveler', partner: 'airport staff', childJa: 'りょこうする ひと' },
      { child: 'airport staff', partner: 'traveler', childJa: 'くうこうの ひと' }
    ],
    twists: ['the bag is lost', 'the plane is going to a surprise country', 'the traveler forgot the passport in a pocket', 'there is a cat in the suitcase'],
    phrases: ['Where are you going?', 'I am going to ___.', 'Here is my passport.', 'Have a nice trip!']
  },
  {
    id: 'tourist', emoji: '🗺️', title: 'みちあんない', titleEn: 'Help a Tourist', category: 'out',
    colors: ['#DFF7E4', '#F5FCF6', '#C9E8C9', '#1BA07D'],
    roles: [{ child: 'local helper', partner: 'lost tourist visiting Japan', childJa: 'たすける ひと' }],
    twists: ['the tourist is looking for the station', 'the tourist wants to find good ramen', 'the tourist wants to see a big temple', 'the tourist lost a hat'],
    phrases: ['Go straight.', 'Turn right / left.', 'It is over there!', 'You are welcome!']
  },
  {
    id: 'zoo', emoji: '🦁', title: 'どうぶつえん', titleEn: 'At the Zoo', category: 'out',
    colors: ['#FFF3D1', '#FFFBEF', '#F2DDA0', '#A87B00'],
    roles: [
      { child: 'zoo visitor', partner: 'zookeeper', childJa: 'おきゃくさん' },
      { child: 'zookeeper', partner: 'zoo visitor', childJa: 'しいくいんさん' }
    ],
    twists: ['a monkey stole a banana', 'a baby elephant was born', 'it is feeding time', 'a penguin escaped and is walking around'],
    phrases: ['Look at the ___!', 'It is big!', 'What does it eat?', 'So cute!']
  },
  {
    id: 'doctor', emoji: '🩺', title: 'おいしゃさん', titleEn: 'Doctor', category: 'home',
    colors: ['#FFE0EC', '#FFF5F9', '#F5C2D6', '#E06A9E'],
    roles: [
      { child: 'doctor', partner: 'sick patient', childJa: 'おいしゃさん' },
      { child: 'patient', partner: 'kind doctor', childJa: 'かんじゃさん' }
    ],
    twists: ['the patient caught a cold and keeps sneezing', 'the patient ate too much candy', 'the patient bumped into a cloud', 'the patient has a tummy ache'],
    phrases: ['What is wrong?', 'My ___ hurts.', 'Open your mouth.', 'Get well soon!']
  },
  {
    id: 'birthday', emoji: '🎂', title: 'たんじょうび', titleEn: 'Birthday Party', category: 'home',
    colors: ['#F1E3FF', '#FAF5FF', '#E2CCF2', '#6A4CD0'],
    roles: [
      { child: 'party guest', partner: 'birthday monster', childJa: 'おきゃくさん' },
      { child: 'birthday child', partner: 'party guest with a present', childJa: 'おたんじょうびの ひと' }
    ],
    twists: ['the present is moving inside the box', 'the cake is shaped like a dinosaur', 'everyone sings a song', 'the candles will not go out'],
    phrases: ['Happy birthday!', 'This is for you.', 'How old are you?', 'Thank you!']
  },
  {
    id: 'picnic', emoji: '🧺', title: 'ピクニック', titleEn: 'Picnic', category: 'out',
    colors: ['#E3F6FF', '#F5FBFF', '#C2E2F2', '#2A84DB'],
    roles: [{ child: 'picnic friend', partner: 'picnic friend', childJa: 'ともだち' }],
    twists: ['ants are coming for the food', 'the wind blows the hat away', 'it starts to rain a little', 'there is a surprise dessert'],
    phrases: ['Let\'s eat!', 'Do you want some?', 'Yes, please!', 'Oh no!']
  },
  {
    id: 'phone', emoji: '📱', title: 'でんわごっこ', titleEn: 'Phone Call', category: 'home',
    colors: ['#E9E6FF', '#F7F6FF', '#D3CDF5', '#6A4CD0'],
    roles: [{ child: 'friend who answers the phone', partner: 'friend calling', childJa: 'でんわに でる ひと' }],
    twists: ['the caller wants to invite the child to play', 'the caller lost their toy and asks for help', 'the caller has big news', 'the caller wants to know the weather'],
    phrases: ['Hello?', 'This is ___.', 'See you!', 'Bye-bye!']
  }
]

export function sceneById(id) {
  return SCENES.find((scene) => scene.id === id) || null
}

export function rollScene(scene, random = Math.random) {
  const role = scene.roles[Math.floor(random() * scene.roles.length)]
  const twist = scene.twists[Math.floor(random() * scene.twists.length)]
  return { sceneId: scene.id, role, twist }
}
