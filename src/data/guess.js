// あてっこゲームのお題。相棒がこっそり1つ選び、ヒントを出して当ててもらう。

export const GUESS_CATEGORIES = [
  {
    id: 'animals', emoji: '🐾', title: 'どうぶつ',
    items: [
      { en: 'a dog', emoji: '🐶' }, { en: 'a cat', emoji: '🐱' }, { en: 'a rabbit', emoji: '🐰' },
      { en: 'an elephant', emoji: '🐘' }, { en: 'a lion', emoji: '🦁' }, { en: 'a giraffe', emoji: '🦒' },
      { en: 'a penguin', emoji: '🐧' }, { en: 'a monkey', emoji: '🐵' }, { en: 'a frog', emoji: '🐸' },
      { en: 'a fish', emoji: '🐟' }, { en: 'a bird', emoji: '🐦' }, { en: 'a pig', emoji: '🐷' }
    ]
  },
  {
    id: 'food', emoji: '🍙', title: 'たべもの',
    items: [
      { en: 'a banana', emoji: '🍌' }, { en: 'an apple', emoji: '🍎' }, { en: 'a strawberry', emoji: '🍓' },
      { en: 'ice cream', emoji: '🍦' }, { en: 'pizza', emoji: '🍕' }, { en: 'a rice ball', emoji: '🍙' },
      { en: 'a carrot', emoji: '🥕' }, { en: 'bread', emoji: '🍞' }, { en: 'a cake', emoji: '🍰' },
      { en: 'an egg', emoji: '🥚' }, { en: 'a watermelon', emoji: '🍉' }, { en: 'noodles', emoji: '🍜' }
    ]
  },
  {
    id: 'vehicles', emoji: '🚗', title: 'のりもの',
    items: [
      { en: 'a car', emoji: '🚗' }, { en: 'a bus', emoji: '🚌' }, { en: 'a train', emoji: '🚃' },
      { en: 'a fire truck', emoji: '🚒' }, { en: 'an airplane', emoji: '✈️' }, { en: 'a boat', emoji: '⛵' },
      { en: 'a bicycle', emoji: '🚲' }, { en: 'a rocket', emoji: '🚀' }, { en: 'a police car', emoji: '🚓' }
    ]
  },
  {
    id: 'things', emoji: '🧸', title: 'みのまわり',
    items: [
      { en: 'a ball', emoji: '⚽' }, { en: 'an umbrella', emoji: '☂️' }, { en: 'a book', emoji: '📖' },
      { en: 'a teddy bear', emoji: '🧸' }, { en: 'a clock', emoji: '⏰' }, { en: 'a hat', emoji: '🧢' },
      { en: 'a pencil', emoji: '✏️' }, { en: 'a cup', emoji: '🥤' }, { en: 'a key', emoji: '🔑' }
    ]
  }
]

export function pickSecret(categoryId, random = Math.random) {
  const category = GUESS_CATEGORIES.find((item) => item.id === categoryId) || GUESS_CATEGORIES[0]
  const item = category.items[Math.floor(random() * category.items.length)]
  return { categoryId: category.id, ...item }
}
