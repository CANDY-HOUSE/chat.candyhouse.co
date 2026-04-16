import { useMediaQueryContext } from '@/context/MediaQueryContext'
import { editorExpandedAtom, editorHeightAtom, UI_CONSTANTS } from '@/store'
import { localKey, putLocalValue } from '@/utils'
import DragIndicatorIcon from '@mui/icons-material/DragHandle'
import { Box } from '@mui/material'
import { useAtom, useAtomValue } from 'jotai'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface Props {
  minHeight?: number
  maxHeight?: number
}

const Min_HEIGHT = 90

export const ResizableDivider: React.FC<Props> = ({
  minHeight = Min_HEIGHT,
  maxHeight = window.innerHeight - Min_HEIGHT
}) => {
  const { isMobile } = useMediaQueryContext()
  const [editorH, setEditorH] = useAtom(editorHeightAtom)
  const editorExpanded = useAtomValue(editorExpandedAtom)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  const customStyle = useMemo(() => {
    const result = {
      cursor: editorExpanded ? 'not-allowed' : 'ns-resize',
      height: `${UI_CONSTANTS.resizeLineWidth}px`,
      flex: 'none',
      position: 'relative',
      userSelect: 'none',
      backgroundColor: 'var(--grey-200)',
      transition: 'all 0.2s',
      '&:hover': {
        backgroundColor: 'var(--grey-400)',

        '& .drag-icon': {
          borderColor: 'var(--grey-400)'
        }
      }
    }

    return result
  }, [editorExpanded])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      if (editorExpanded) return
      setIsDragging(true)
      startYRef.current = e.clientY
      startHeightRef.current = editorH
    },
    [editorH, editorExpanded]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return

      requestAnimationFrame(() => {
        const deltaY = startYRef.current - e.clientY

        const newHeight = startHeightRef.current + deltaY
        const clampedHeight = Math.max(minHeight, Math.min(newHeight, maxHeight))

        setEditorH(clampedHeight)
        putLocalValue(localKey.editorHeight, clampedHeight)
      })
    },
    [isDragging, setEditorH, minHeight, maxHeight]
  )

  const handleMouseUp = useCallback(() => {
    if (editorExpanded) return
    setIsDragging(false)
  }, [editorExpanded])

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

  return (
    <Box onMouseDown={handleMouseDown} sx={customStyle}>
      {!isMobile && (
        <Box
          className="drag-icon"
          sx={{
            zIndex: 99,
            position: 'absolute',
            left: '50%',
            top: 0,
            transform: 'translateX(-50%)',
            color: 'var(--grey-400)',
            cursor: 'pointer',
            backgroundColor: '#fff',
            display: 'flex',
            justifyContent: 'center',
            px: '26px',
            borderBottom: `${UI_CONSTANTS.resizeLineWidth}px solid`,
            borderLeft: `${UI_CONSTANTS.resizeLineWidth}px solid`,
            borderRight: `${UI_CONSTANTS.resizeLineWidth}px solid`,
            borderBottomLeftRadius: '8px',
            borderBottomRightRadius: '8px',
            borderColor: 'var(--grey-200)'
          }}
        >
          <DragIndicatorIcon
            sx={{
              fontSize: '16px',
              transform: 'scaleX(1.8)'
            }}
          />
        </Box>
      )}
    </Box>
  )
}
