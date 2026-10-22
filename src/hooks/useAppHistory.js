import { useEffect, useRef } from 'react'
import { readRoute, routeHash } from '../lib/routes.js'
export function useAppHistory({
  screen,
  selectedLesson,
  libraryKind,
  onRestore,
  blocked = false
}) {
  const latest = useRef(onRestore)
  latest.current = onRestore
  const restoring = useRef(false)
  useEffect(() => {
    const listener = () => {
      restoring.current = true
      latest.current(readRoute() || { screen: 'who', lesson: null, kind: null })
    }
    addEventListener('popstate', listener)
    return () => removeEventListener('popstate', listener)
  }, [])
  useEffect(() => {
    if (blocked) return
    const hash = routeHash({
      screen,
      lesson: selectedLesson,
      kind: libraryKind
    })
    if (!hash) return
    if (restoring.current) {
      restoring.current = false
      if (location.hash !== hash) history.replaceState({ mee: true }, '', hash)
      return
    }
    if (location.hash !== hash) {
      if (!location.hash) history.replaceState({ mee: true }, '', hash)
      else history.pushState({ mee: true }, '', hash)
    }
  }, [
    screen,
    selectedLesson?.id,
    selectedLesson?.audience,
    libraryKind,
    blocked
  ])
  useEffect(() => {
    if (screen !== 'talk') return
    const handler = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    addEventListener('beforeunload', handler)
    return () => removeEventListener('beforeunload', handler)
  }, [screen])
}
