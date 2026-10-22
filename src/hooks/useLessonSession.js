import { useEffect, useRef, useState } from 'react'
import { learnerProgress, saveLessonDraft } from '../lib/learning.js'
export function useLessonSession({
  item,
  learning,
  learnerId,
  updateLearning
}) {
  const initial = {
    phase: 'learn',
    index: 0,
    answers: {},
    notes: {},
    node: item.start || 'start',
    path: [],
    help: false,
    mode: 'guided'
  }
  const [draft, setDraft] = useState(() => ({
    ...initial,
    ...learnerProgress(learning, learnerId).drafts[item.id]
  }))
  const draftRef = useRef(draft)
  const updateRef = useRef(updateLearning)
  updateRef.current = updateLearning
  const commit = (next) => {
    if (
      updateRef.current((prev) =>
        saveLessonDraft(prev, learnerId, item.id, next)
      ) === false
    )
      return false
    draftRef.current = next
    setDraft(next)
    return true
  }
  useEffect(() => {
    updateRef.current((prev) =>
      saveLessonDraft(prev, learnerId, item.id, draftRef.current)
    )
  }, [item.id, learnerId])
  const patch = (value) =>
    commit({
      ...draftRef.current,
      ...(typeof value === 'function' ? value(draftRef.current) : value)
    })
  return { draft, patch, restart: () => commit(initial) }
}
