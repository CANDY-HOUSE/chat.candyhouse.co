import { useCallback } from 'react'
import { store, topicsAtom } from '../store'
import type { ITopics } from '../types/messagetypes'

export const useTopic = () => {
  const updateAttrsValue = useCallback((topicId: string, patch: Partial<Omit<ITopics, 'id'>>) => {
    store.set(topicsAtom, (prev) => {
      const i = prev.findIndex((t) => t.id === topicId)
      if (i === -1) return prev

      if (!patch || Object.keys(patch).length === 0) return prev
      const noActualChange = Object.keys(patch).every(
        (k) => (prev[i] as any)[k] === (patch as any)[k]
      )
      if (noActualChange) return prev

      const next = prev.slice()
      next[i] = { ...prev[i]!, ...patch }
      return next
    })
  }, [])

  const getTopic = useCallback((topicId: string) => {
    const topics = store.get(topicsAtom)
    return topics.find((t) => t.id === topicId) || null
  }, [])

  return {
    getTopic,
    updateAttrsValue
  }
}
