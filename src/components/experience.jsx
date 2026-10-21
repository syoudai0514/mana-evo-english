import React from 'react'

const paths = {
  home: 'm3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9',
  spark: 'm12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7Z',
  chat: 'M21 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 19 0ZM7 11h.01M12 11h.01M17 11h.01',
  book: 'M12 5v16M12 5C8 2 4 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-2-1-6-2-10 1Z',
  headphones:
    'M4 14v-3a8 8 0 0 1 16 0v3M4 13h3v8H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Zm16 0h-3v8h3a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2Z',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  check: 'm5 12 4 4L19 6',
  clock: 'M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  leaf: 'M20 3C7 1 1 8 5 16s18 3 15-13ZM4 21 16 8',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M13 3a4 4 0 0 1 0 8M12 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  settings:
    'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2'
}
export function Icon({ name, size = 22, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.spark} />
    </svg>
  )
}
export function Brand({ adult = false }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Icon name="leaf" />
      </span>
      <span>
        mana evo
        <span className="brand-sub">ENGLISH {adult ? ' / STUDIO' : ''}</span>
      </span>
    </div>
  )
}
export function WeekTrail({ days, kid = false }) {
  return (
    <div className="week-trail" aria-label="直近7日間の学習記録">
      {days.map((day) => (
        <div
          key={day.key}
          className={`week-day ${day.done ? 'complete' : ''} ${day.today ? 'today' : ''}`}
        >
          <span>{day.label}</span>
          <span
            className="week-dot"
            aria-label={`${day.label}曜日${day.today ? '・今日' : ''}：${day.done ? '学習済み' : '未学習'}`}
          >
            {day.done ? (
              <Icon name="check" size={17} />
            ) : day.today ? (
              <span className="today-dot" />
            ) : (
              '·'
            )}
          </span>
        </div>
      ))}
      <span className="week-note">
        {kid ? 'すこしずつで、だいじょうぶ。' : '今日の一歩を、積み重ねよう。'}
      </span>
    </div>
  )
}
