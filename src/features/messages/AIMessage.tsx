import { useUnifiedPress } from '@/hooks/useUnifiedPress'
import type { ContentBlock } from '@/types/messagetypes'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import Avatar from '@mui/material/Avatar'
import AvatarGroup from '@mui/material/AvatarGroup'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import { useTheme } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LoadingDots } from '../../components/LoadingDots'
import { Markdown } from './Markdown'

interface AIMessageProps {
  content: ContentBlock[]
  thoughtValue?: string
  annotations?: Array<string>
}

interface AIMessageState {
  thinking: string
  answer: string
}

export const AIMessage: React.FC<AIMessageProps> = ({
  content,
  thoughtValue = '',
  annotations
}) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const [data, setData] = useState<AIMessageState>({
    thinking: thoughtValue,
    answer: ''
  })
  const [viewMode, setViewMode] = useState<'both' | 'thinking' | 'answer'>('both')

  const thinkProcessRef = useRef<HTMLElement>(null)

  useUnifiedPress(thinkProcessRef, () => {
    setViewMode(viewMode === 'both' ? 'answer' : 'both')
  })

  // web search annotations
  const annotationsComp = useMemo(() => {
    if (!annotations || annotations.length === 0) return null

    return (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ my: 'var(--spacing-sm)' }}>
        <AvatarGroup
          sx={{
            '& .MuiAvatarGroup-avatar': {
              color: 'white',
              width: 30,
              height: 30,
              fontSize: 12,
              ml: '-8px'
            }
          }}
          spacing="small"
          total={annotations.length}
          max={6}
        >
          {annotations.map((url: string, index: number) => (
            <Avatar sx={{ background: '#fff', overflow: 'hidden' }} src={url} key={index} />
          ))}
        </AvatarGroup>
        <Typography sx={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
          {t('source')}
        </Typography>
      </Stack>
    )
  }, [annotations, t])

  useEffect(() => {
    let answer = ''
    // 解析 content
    content.forEach((item) => {
      switch (item.type) {
        case 'text':
        case 'video':
          answer += item.content
          break
        case 'image':
          answer += `\n![Generated Image](${item.url})\n`
          break
      }
    })

    setData((prev) => ({
      ...prev,
      thinking: thoughtValue,
      answer
    }))
  }, [content, thoughtValue])

  useEffect(() => {
    thinkProcessRef.current = null
  }, [])

  return (
    <Box className="deep-thinking">
      {/* 思考时间 */}
      {data.thinking && (
        <Stack
          ref={(element) => {
            thinkProcessRef.current = element
          }}
          direction="row"
          alignItems="center"
          sx={{ color: theme.palette.text.secondary, cursor: 'pointer' }}
        >
          <Typography variant="body1">{t('deepThink.thinkingLabel')}</Typography>
          <KeyboardArrowUpIcon
            sx={{
              fontSize: '1.1rem',
              verticalAlign: 'bottom',
              transform: viewMode === 'answer' ? 'rotate(180deg)' : ''
            }}
          ></KeyboardArrowUpIcon>
        </Stack>
      )}

      {/* 思考过程 */}
      {(viewMode === 'both' || viewMode === 'thinking') && data.thinking && (
        <Box
          className="thinking-container"
          sx={{
            pl: '10px',
            borderLeft: 3,
            borderColor: '#ccc',
            my: 'var(--spacing-sm)'
          }}
        >
          <Box className="thinking-content" sx={{ color: theme.palette.text.secondary }}>
            <Markdown isThinking>{data.thinking}</Markdown>
          </Box>
        </Box>
      )}

      {/* 最终答案 */}
      {(viewMode === 'both' || viewMode === 'answer') && data.answer && (
        <Box className="answer-container">
          <Box className="answer-content">
            <Markdown allowedVideoNonces={['video']}>{data.answer}</Markdown>
          </Box>
        </Box>
      )}

      {/* web search annotations */}
      {annotationsComp}

      {!data.thinking && !data.answer && <LoadingDots />}
    </Box>
  )
}
