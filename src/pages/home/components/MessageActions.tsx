import { useAi } from '@/hooks/useAi'
import { useConversation } from '@/hooks/useConversation'
import { useUnifiedPress } from '@/hooks/useUnifiedPress'
import { type IMessage } from '@/types/messagetypes'
import { MessageState, SendType } from '@constants'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import RefreshIcon from '@mui/icons-material/Refresh'
import SouthIcon from '@mui/icons-material/South'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { ai, enhanceEventParams, utils } from '@utils'
import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  conversationId: string
  message: IMessage
  anchorRef: React.RefObject<HTMLElement | null>
}

const MessageActions: React.FC<Props> = ({ message, conversationId, anchorRef }) => {
  const { t } = useTranslation()
  const refreshRef = useRef<HTMLElement>(null)
  const editRef = useRef<HTMLElement>(null)
  const copyRef = useRef<HTMLElement>(null)
  const deleteRef = useRef<HTMLElement>(null)
  const { sendMessage } = useAi()
  const { deleteMessage, updateMessage, applyCacheControlWithAccurateTokens } = useConversation()

  useUnifiedPress(refreshRef, async () => {
    let _message = { ...message }
    if (ai.getModelProvider(_message.model) === 'Anthropic') {
      _message = (await applyCacheControlWithAccurateTokens(conversationId, _message)) ?? _message
    }

    sendMessage(conversationId, _message, {
      sendType: SendType.refresh
    })

    gtag(
      'event',
      'chat_revision',
      enhanceEventParams({
        revision_type: 'regenerate_response',
        model_name: message.model
      })
    )
  })

  useUnifiedPress(editRef, () => {
    updateMessage(conversationId, message.messageId!, { state: MessageState.edit })

    gtag(
      'event',
      'chat_revision',
      enhanceEventParams({
        revision_type: 'edit_prompt',
        model_name: message.model
      })
    )
  })

  useUnifiedPress(copyRef, () => {
    utils.copyRichText(anchorRef)
  })

  useUnifiedPress(deleteRef, () => deleteMessage(conversationId, message.messageId || ''))

  useEffect(() => {
    refreshRef.current = null
    editRef.current = null
    copyRef.current = null
    deleteRef.current = null
  }, [])

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '.3rem',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
        p: '.1rem .2rem'
      }}
    >
      {!message.model.includes('realtime') && (
        <Tooltip title={t('Refresh')}>
          <IconButton
            ref={(element) => {
              refreshRef.current = element
            }}
          >
            {message.role === 'user' ? (
              <SouthIcon
                sx={{
                  fontSize: 'var(--icon-size-small)'
                }}
              />
            ) : (
              <RefreshIcon
                sx={{
                  fontSize: 'var(--icon-size-small)'
                }}
              />
            )}
          </IconButton>
        </Tooltip>
      )}

      {!message.model.includes('realtime') && (
        <Tooltip title={t('edit')}>
          <IconButton
            ref={(element) => {
              editRef.current = element
            }}
          >
            <EditIcon
              sx={{
                fontSize: 'var(--icon-size-small)'
              }}
            />
          </IconButton>
        </Tooltip>
      )}

      <Tooltip title={t('Copy')}>
        <IconButton
          ref={(element) => {
            copyRef.current = element
          }}
        >
          <ContentCopyIcon
            sx={{
              fontSize: 'var(--icon-size-small)'
            }}
          />
        </IconButton>
      </Tooltip>

      <Tooltip title={t('delete')}>
        <IconButton
          ref={(element) => {
            deleteRef.current = element
          }}
        >
          <DeleteIcon
            sx={{
              fontSize: 'var(--icon-size-small)'
            }}
          />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

export default React.memo(MessageActions)
