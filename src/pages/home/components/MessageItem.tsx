import { AiAvatarIcon } from '@/components/AiAvatarIcon'
import { LoadingDots } from '@/components/LoadingDots'
import EditorPanelInner from '@/features/editor/EditorPanelInner'
import { AIMessage } from '@/features/messages/AIMessage'
import { UserMessage } from '@/features/messages/UserMessage'
import { useConversation } from '@/hooks/useConversation'
import { useMessage } from '@/hooks/useMessage'
import { store, userAtom, workingModelsAtom } from '@/store'
import { type ContentBlock, type IMessage } from '@/types/messagetypes'
import { utils } from '@/utils'
import { apiMessagesUpdate } from '@api'
import { MessageState } from '@constants'
import { Stack, Typography } from '@mui/material'
import Box from '@mui/material/Box'
import { useAtomValue } from 'jotai'
import { motion } from 'motion/react'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MessageActions from './MessageActions'

interface Props {
  message: IMessage
  conversationId: string
}

const MessageItem: React.FC<Props> = ({ message, conversationId }) => {
  const user = useAtomValue(userAtom)
  const workingModels = useAtomValue(workingModelsAtom)
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  const {
    state,
    role,
    model,
    content,
    messageId,
    annotations,
    thoughtValue,
    words,
    tokens,
    totalTokens,
    createdAt,
    isCurrentQuestion
  } = message

  const contentRef = useRef<HTMLElement>(null)
  const refMessage = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const isDragging = useRef(false)

  const { updateMessage } = useConversation()
  const { uploadFiles } = useMessage()

  const metaData = useMemo(() => {
    const parts: string[] = []
    if (words) parts.push(`${t('wordCount')}: ${words}`)
    if (tokens) parts.push(`${t('outputTokens')}: ${tokens}`)
    if (totalTokens) parts.push(`${t('totalTokens')}: ${totalTokens}`)
    if (model) parts.push(`${t('model')}: ${model}`)
    if (createdAt) parts.push(`${t('time')}: ${utils.utcToReadable(createdAt)}`)

    return parts.join(', ')
  }, [createdAt, model, t, tokens, totalTokens, words])

  const isAtWork = useMemo(() => {
    const models = workingModels.find(
      ({ atom }) => store.get(atom).conversationId === conversationId
    )
    if (!models) return false
    const conv = store.get(models.atom)
    if (!conv || !conv.modelInfo.atWork) return false

    return isCurrentQuestion
  }, [conversationId, isCurrentQuestion, workingModels])

  const handleEditorSubmit = useCallback(
    async (blocks: ContentBlock[] | null) => {
      let uploadedContent: ContentBlock[] | null = null
      let success = true

      if (blocks) {
        uploadedContent = await uploadFiles(blocks)
      }

      if (user?.isLogin && uploadedContent) {
        success = await apiMessagesUpdate(conversationId, messageId!, {
          content: uploadedContent
        })
      }

      if (success) {
        updateMessage(conversationId, messageId!, {
          state: MessageState.finish,
          ...(uploadedContent && { content: uploadedContent })
        })
      }
    },
    [conversationId, messageId, updateMessage, uploadFiles, user?.isLogin]
  )

  const messageContentComp = useMemo(() => {
    switch (true) {
      case state === MessageState.loading:
        return <LoadingDots />
      case state === MessageState.edit:
        return (
          <EditorPanelInner embed={true} contentBlock={content} submitFn={handleEditorSubmit} />
        )
      case state === MessageState.error:
        return (
          <Typography variant="body1" color="error" sx={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
            {content && content.length > 0 ? content[0]?.content : t('noAvailableInformation')}
          </Typography>
        )
      case role === 'user':
        return <UserMessage className="ql-container ql-snow" blocks={content} />
      default:
        return <AIMessage content={content} thoughtValue={thoughtValue} annotations={annotations} />
    }
  }, [state, content, handleEditorSubmit, t, role, thoughtValue, annotations])

  return (
    <Box
      ref={refMessage}
      sx={{
        position: 'relative',
        mt: 'var(--spacing-xs)',
        pb: '2.6rem',
        overflowX: 'hidden',
        width: '100%',
        '@media (hover: hover)': {
          '&:hover .msg-actions-wrapper': { display: 'block' }
        }
      }}
      onTouchStart={(e) => {
        const touch = e.touches[0]
        if (!touch) return
        startX.current = touch.clientX
        startY.current = touch.clientY
        isDragging.current = false
      }}
      onTouchMove={(e) => {
        const touch = e.touches[0]
        if (!touch) return
        const diffX = Math.abs(touch.clientX - startX.current)
        const diffY = Math.abs(touch.clientY - startY.current)

        if (diffX > 10 || diffY > 10) {
          isDragging.current = true
        }
      }}
      onTouchEnd={() => {
        if (!isDragging.current) {
          setHovered(!hovered)
        }
      }}
    >
      <Stack direction="row" spacing={2} sx={{ px: 'var(--spacing-sm)', overflow: 'hidden' }}>
        <Box sx={{ flex: 'none' }}>
          <AiAvatarIcon role={role} model={model} />
        </Box>

        <Box sx={{ overflow: 'hidden', flex: 'auto' }}>
          <motion.div
            style={{
              position: 'relative',
              padding: '2px',
              borderRadius: '8px',
              overflow: 'hidden'
            }}
          >
            {/* 渐变背景层 */}
            {isAtWork && (
              <motion.div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(90deg,
          #00B4DB 0%,
          #9B59B6 25%,
          #E74C3C 50%,
          #F1C40F 75%,
          #27AE60 100%`,
                  backgroundSize: '300% 100%'
                }}
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                }}
                transition={{
                  duration: 3,
                  ease: 'linear',
                  repeat: Infinity
                }}
              />
            )}

            {/* 内容层 */}
            <Box
              sx={{
                position: 'relative',
                backgroundColor: '#fff',
                borderRadius: '6px',
                padding: 'var(--spacing-sm)',
                zIndex: 1
              }}
            >
              <Box ref={contentRef}>{messageContentComp}</Box>
              <Typography
                sx={{
                  color: 'var(--text-secondary)',
                  mt: 'var(--spacing-xs)',
                  fontSize: '12px'
                }}
              >
                {metaData}
              </Typography>
            </Box>
          </motion.div>
        </Box>
      </Stack>

      <Box
        className="msg-actions-wrapper"
        sx={{
          display: hovered ? 'block' : 'none',
          position: 'absolute',
          bottom: '5px',
          left: '3rem'
        }}
      >
        <MessageActions
          anchorRef={contentRef}
          message={message}
          conversationId={conversationId || ''}
        />
      </Box>
    </Box>
  )
}

export default React.memo(MessageItem)
