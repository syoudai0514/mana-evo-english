import { renderLines, assemble, RATE, EPISODE_VERSION } from './episodes.js'
import { encodeWav } from './wav.js'
import { saveEpisode } from './episodeStore.js'
import { isSignedIn } from './auth.js'
import { isMockMode } from './config.js'
export function curatedScript(item) {
  const original = item.script.map((row) => ({ ...row, say: row.en }))
  const repeat = item.script.map((row) => ({
    ...row,
    say: row.en,
    slow: true,
    pauseBefore: 2
  }))
  const practice = item.phrases.flatMap((row) => [
    { speaker: 'JA', en: row.ja, ja: row.ja, say: row.ja },
    { speaker: 'Alex', en: row.en, ja: row.ja, say: row.en, pauseBefore: 3 },
    { speaker: 'Alex', en: row.en, ja: row.ja, say: row.en, pauseBefore: 2 }
  ])
  return [...original, ...repeat, ...practice, ...original]
}
export async function prepareCuratedEpisode(
  item,
  adult,
  onProgress = () => {}
) {
  if (!isSignedIn() && !isMockMode())
    throw Object.assign(new Error('auth'), { code: 'auth' })
  const script = curatedScript(item)
  onProgress({ stage: 'voice', done: 0, total: script.length })
  const clips = await renderLines(script, (done, total) =>
    onProgress({ stage: 'voice', done, total })
  )
  const joined = assemble(script, clips)
  if (joined.lines.length !== script.length)
    throw Object.assign(new Error('incomplete audio'), { code: 'voice' })
  const episode = {
    id: `curated:${adult.id}:${item.id}:v${item.version}`,
    adultId: adult.id,
    kind: 'curated',
    mock: isMockMode(),
    sourceLessonId: item.id,
    title: item.title.ja,
    createdAt: Date.now(),
    duration: joined.duration,
    lines: joined.lines,
    tips: item.phrases,
    sets: undefined,
    audio: new Blob([encodeWav(joined.samples, RATE)], { type: 'audio/wav' }),
    position: 0,
    listened: false,
    v: EPISODE_VERSION
  }
  await saveEpisode(episode)
  return episode
}
