import { todayKey } from './state.js'

// Calendar days (rather than 24h offsets) also work across daylight-saving changes.
export function weekTrail(completedDays, date = new Date()) {
  const completed = new Set(completedDays)
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(date)
    day.setDate(day.getDate() - 6 + index)
    const key = todayKey(day)
    return {
      key,
      label: '日月火水木金土'[day.getDay()],
      today: index === 6,
      done: completed.has(key)
    }
  })
}
export function kidLearningDays(state) {
  const days = state.sessions
    .filter((item) => item.endedAt && item.mode !== 'adult')
    .map((item) => todayKey(new Date(item.endedAt)))
  if (state.letter?.played) days.push(state.letter.day)
  return [...days, ...(state.studyDays || [])]
}
export function adultLearningDays(adult) {
  return [
    ...adult.sessions.map((item) => item.endedAt),
    ...adult.answers.map((item) => item.date),
    ...adult.shadows.map((item) => item.date),
    ...(adult.studyDays || [])
  ]
    .filter(Boolean)
    .map((value) =>
      todayKey(new Date(`${value.length === 10 ? value + 'T12:00:00' : value}`))
    )
}
export function validToeicTarget(value) {
  const number = Number(value)
  return (
    Number.isInteger(number) &&
    number >= 10 &&
    number <= 990 &&
    number % 5 === 0
  )
}
