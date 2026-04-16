import { useEffect, useRef } from 'react'

interface UseUnifiedPressOptions {
  fallbackToTouch?: boolean
  preventDefault?: boolean // 是否阻止默认行为
  passive?: boolean // 被动监听器
  capture?: boolean // 捕获阶段
}

export function useUnifiedPress(
  ref: React.RefObject<HTMLElement | null>,
  handler: (e: Event) => void,
  options: UseUnifiedPressOptions = {}
) {
  const {
    fallbackToTouch = false,
    preventDefault = false,
    passive = true,
    capture = false
  } = options

  const handlerRef = useRef(handler)

  // 保持最新的 handler 引用
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const unifiedHandler = (e: Event) => {
      if (preventDefault) {
        e.preventDefault()
      }

      handlerRef.current(e as PointerEvent | TouchEvent | MouseEvent)
    }

    const listenerOptions = { passive, capture }

    if ('PointerEvent' in window && !fallbackToTouch) {
      node.addEventListener('pointerdown', unifiedHandler, listenerOptions)
    } else {
      // 降级方案
      node.addEventListener('touchstart', unifiedHandler, listenerOptions)
      node.addEventListener('mousedown', unifiedHandler, listenerOptions)
    }

    return () => {
      node.removeEventListener('pointerdown', unifiedHandler)
      node.removeEventListener('touchstart', unifiedHandler)
      node.removeEventListener('mousedown', unifiedHandler)
    }
  }, [ref, fallbackToTouch, preventDefault, passive, capture])
}
