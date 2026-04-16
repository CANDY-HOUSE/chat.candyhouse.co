import hotkeys from 'hotkeys-js'
import { useEffect, useRef } from 'react'

export const useCommandK = (callback: () => void) => {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      event.preventDefault()
      callbackRef.current()
    }

    hotkeys('command+k, ctrl+k', { keydown: true, capture: true }, handler)

    return () => {
      hotkeys.unbind('command+k, ctrl+k', handler)
    }
  }, [])
}
