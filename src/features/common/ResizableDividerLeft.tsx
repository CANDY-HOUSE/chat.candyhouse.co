import { UI_CONSTANTS, isShowSideBarAtom, sideBarWidthAtom } from '@/store'
import { Box } from '@mui/material'
import { getDefaultStore, useAtom } from 'jotai'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface Props {
  minWidth?: number
  maxWidth?: number
}

export const ResizableDividerLeft: React.FC<Props> = ({
  minWidth = UI_CONSTANTS.resizeLineWidth,
  maxWidth = window.innerWidth - UI_CONSTANTS.resizeLineWidth
}) => {
  const [sideBarW, setSideBarW] = useAtom(sideBarWidthAtom)
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const sxSty = useMemo(() => {
    const bg = isDragging ? 'var(--grey-400)' : 'transparent'

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

    return result
  }, [isDragging])

  const reset = useCallback(() => {
    getDefaultStore().set(isShowSideBarAtom, false)
    setSideBarW(UI_CONSTANTS.sideBarWidth)
  }, [setSideBarW])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return
      requestAnimationFrame(() => {
        const deltaX = e.clientX - startXRef.current
        const newWidth = startWidthRef.current + deltaX
        const clampedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth))
        setSideBarW(clampedWidth)

        if (clampedWidth <= UI_CONSTANTS.resizeLineWidth) {
          reset()
        }
      })
    },
    [isDragging, minWidth, maxWidth, setSideBarW, reset]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      startXRef.current = e.clientX
      startWidthRef.current = sideBarW
    },
    [sideBarW]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
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

  return <Box onMouseDown={handleMouseDown} sx={sxSty} />
}
