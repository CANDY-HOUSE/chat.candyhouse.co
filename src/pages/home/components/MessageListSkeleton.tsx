import { UI_CONSTANTS } from '@/store'
import { Box, Skeleton, Stack } from '@mui/material'
import React from 'react'

interface Props {
  /** 每列宽度（px），列数即数组长度 */
  columnWidths: number[]
}

// 列内消息占位的气泡高度，长短交错模拟真实对话节奏
const BUBBLE_HEIGHTS = [56, 120, 50, 160, 72, 104]

/**
 * 首屏消息区骨架屏。首次加载要等话题 → 会话 → 消息三段请求串完，
 * 期间会话区本来是整片空白，这里按最终版面（吸顶头部 + 分栏气泡）占位
 */
const MessageListSkeleton: React.FC<Props> = ({ columnWidths }) => (
  <Box
    sx={{
      flex: 'auto',
      display: 'flex',
      flexDirection: 'row',
      overflow: 'hidden',
      background: 'var(--color-background)',
      pointerEvents: 'none'
    }}
  >
    {columnWidths.map((width, index) => (
      <React.Fragment key={index}>
        {index > 0 && (
          <Box
            sx={{
              width: `${UI_CONSTANTS.resizeLineWidth}px`,
              flex: 'none',
              background: 'var(--color-background)'
            }}
          />
        )}

        <Box sx={{ width, flex: 'none', height: '100%', position: 'relative', overflow: 'hidden' }}>
          {/* 吸顶头部占位，和 MessageHeader 同高同色 */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 1,
              height: UI_CONSTANTS.messageHeaderHeight,
              display: 'flex',
              alignItems: 'center',
              px: 'var(--spacing-xs)',
              background: 'var(--header-overlay-bg)'
            }}
          >
            <Skeleton variant="rounded" width={120} height={14} />
          </Box>

          <Box sx={{ pt: `calc(${UI_CONSTANTS.messageHeaderHeight} + var(--spacing-sm))` }}>
            {BUBBLE_HEIGHTS.map((height, i) => (
              // 行结构对齐 MessageItem：左侧 2rem 圆形头像 + 右侧撑满的气泡
              <Stack
                key={i}
                direction="row"
                spacing={2}
                sx={{
                  mt: 'var(--spacing-xs)',
                  pb: '2rem',
                  pl: 'var(--spacing-sm)',
                  pr: 'var(--spacing-md)'
                }}
              >
                <Skeleton variant="circular" sx={{ flex: 'none', width: '2rem', height: '2rem' }} />
                <Skeleton
                  variant="rounded"
                  height={height}
                  sx={{ flex: 'auto', borderRadius: '8px' }}
                />
              </Stack>
            ))}
          </Box>
        </Box>
      </React.Fragment>
    ))}
  </Box>
)

export default React.memo(MessageListSkeleton)
