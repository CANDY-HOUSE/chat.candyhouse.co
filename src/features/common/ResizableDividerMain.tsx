import type { WidthItem } from '@/context/MessageListContext'
import { UI_CONSTANTS } from '@/store'
import { Box } from '@mui/material'
import { red } from '@mui/material/colors'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface Props {
  index: number
  channelsWidth: WidthItem[]
  onResize: (newWidth: number) => void
  panelRef: React.RefObject<HTMLDivElement | null>
}

export const ResizableDividerMain: React.FC<Props> = ({
  index,
  channelsWidth,
  onResize,
  panelRef
}) => {
  const startXRef = useRef(0)
  const [moveDisable, setMoveDisable] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [initWidth, setInitWidth] = useState<number>(-1)
  const sxSty = useMemo(() => {
    const bg = isDragging ? 'var(--grey-400)' : '#fff'

    const result = {
      cursor: 'ew-resize',
      width: isDragging ? `5px` : `${UI_CONSTANTS.resizeLineWidth}px`,
      flex: 'none',
      position: 'relative',
      userSelect: 'none',
      backgroundColor: bg,
      transition: 'all 0.2s',
      '&:hover': {
        width: `5px`,
        backgroundColor: 'var(--grey-400)'
      }
    }

    if (moveDisable) {
      result.backgroundColor = red[500]
    }

    return result
  }, [isDragging, moveDisable])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      // 记录鼠标按下时 起始位置&初始宽度
      setIsDragging(true)
      startXRef.current = e.clientX
      const channelWidth = channelsWidth[index]
      if (!channelWidth) return
      setInitWidth(channelWidth.width)
    },
    [channelsWidth, index]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      // 鼠标拖动时 计算channel宽度
      if (!isDragging || initWidth === -1 || moveDisable) return
      requestAnimationFrame(() => {
        let newWidth = e.clientX - startXRef.current + initWidth
        let disable = false
        newWidth = Math.floor(newWidth)

        if (newWidth <= UI_CONSTANTS.chatMinWidth) {
          newWidth = UI_CONSTANTS.chatMinWidth
          disable = true
        } else if (newWidth >= panelRef.current!.offsetWidth) {
          newWidth = panelRef.current!.offsetWidth
          disable = true
        } else {
          disable = false
        }

        setMoveDisable(disable)
        setTimeout(() => {
          setMoveDisable(false)
        }, 200)

        !disable && onResize(newWidth)
      })
    },
    [isDragging, initWidth, moveDisable, panelRef, onResize]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setInitWidth(-1)
    startXRef.current = 0
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return <Box onMouseDown={handleMouseDown} sx={sxSty}></Box>
}
