import ArrowBackIos from '@mui/icons-material/ArrowBackIos'
import ArrowForwardIos from '@mui/icons-material/ArrowForwardIos'
import { Box, IconButton } from '@mui/material'
import { styled } from '@mui/material/styles'
import React, { useEffect, useRef, useState } from 'react'

interface HorizontalCollapseContainerProps {
  width?: number | string
  expanded?: boolean
  animating?: boolean
}

interface HorizontalCollapseProps {
  children: React.ReactNode
  expanded?: boolean
  togglePosition?: 'start' | 'end' | 'none'
  onToggle?: (isExpanded: boolean) => void
  sx?: React.CSSProperties | object
  [key: string]: unknown
}

// 横向折叠容器
const HorizontalCollapseContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'width' && prop !== 'expanded' && prop !== 'animating'
})<HorizontalCollapseContainerProps>(({ theme, width, expanded, animating }) => ({
  overflow: 'hidden',
  transition: theme.transitions.create('width', {
    duration: theme.transitions.duration.standard
  }),
  width: expanded ? width : 0,
  visibility: expanded || animating ? 'visible' : 'hidden'
}))

/**
 * 横向折叠/展开组件
 * @param {Object} props
 * @param {React.ReactNode} children - 要折叠/展开的内容
 * @param {boolean} expanded - 是否展开
 * @param {function} onToggle - 切换状态的回调
 * @param {string} togglePosition - 切换按钮位置 ('start', 'end', 'none')
 * @param {Object} sx - 额外的样式
 */
export const HorizontalCollapse: React.FC<HorizontalCollapseProps> = ({
  children,
  expanded = false,
  onToggle,
  togglePosition,
  sx,
  ...props
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded)
  const [isAnimating, setIsAnimating] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentWidth, setContentWidth] = useState(0)

  // 同步外部expanded状态
  useEffect(() => {
    setIsExpanded(expanded)
  }, [expanded])

  // 测量内容宽度
  useEffect(() => {
    setTimeout(() => {
      if (contentRef.current) {
        setContentWidth(contentRef.current.offsetWidth)
      }
    }, 100)
  }, [children])

  // 处理动画状态
  useEffect(() => {
    if (isExpanded !== expanded) {
      setIsAnimating(true)
      const timer = setTimeout(() => {
        setIsAnimating(false)
      }, 300) // 与过渡时间匹配
      return () => clearTimeout(timer)
    }
  }, [isExpanded, expanded])

  const handleToggle = () => {
    const newState = !isExpanded
    setIsExpanded(newState)
    if (onToggle) onToggle(newState)
  }

  const renderToggleButton = () => {
    if (togglePosition === 'none') return null

    return (
      <IconButton
        onClick={handleToggle}
        sx={{
          border: '1px solid divider',
          '&:hover': { bgcolor: 'action.hover' },
          '& svg': {
            height: '86%!important',
            width: '86%!important'
          }
        }}
      >
        {isExpanded ? <ArrowForwardIos /> : <ArrowBackIos />}
      </IconButton>
    )
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }} {...props}>
      {togglePosition === 'start' && renderToggleButton()}

      <HorizontalCollapseContainer
        width={contentWidth}
        expanded={isExpanded}
        animating={isAnimating}
      >
        <Box ref={contentRef} sx={{ width: 'max-content', ...sx }}>
          {children}
        </Box>
      </HorizontalCollapseContainer>

      {togglePosition === 'end' && renderToggleButton()}
    </Box>
  )
}
