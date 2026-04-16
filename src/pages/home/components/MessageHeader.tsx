import { CSwitch } from '@/components/CSwitch'
import { useMediaQueryContext } from '@/context/MediaQueryContext'
import { useMessageListContext } from '@/context/MessageListContext'
import Settings from '@/features/common/Settings'
import RealtimeAudio, { type RealtimeAudioRef } from '@/features/media/RealtimeAudio'
import { useConversation } from '@/hooks/useConversation'
import { focusMessageAtom, userAtom, viewTypeAtom } from '@/store'
import type { IConversation } from '@/types/messagetypes'
import { enhanceEventParams } from '@/utils'
import { apiConversationsUpdate } from '@api'
import { MessageState, ViewModel } from '@constants'
import StopIcon from '@mui/icons-material/Stop'
import { Box, IconButton, Stack, Typography } from '@mui/material'
import { useAtomValue } from 'jotai'
import React, { type FC, useEffect, useMemo, useRef } from 'react'

interface Props {
  conversation: IConversation
  panelRef: React.RefObject<HTMLDivElement | null>
}

const customStyle = {
  container: {
    position: 'absolute',
    zIndex: 999,
    height: '2.6rem',
    width: '100%',
    left: 0,
    top: 0
  }
}

const MessageHeader: FC<Props> = ({ conversation, panelRef }) => {
  const { isMobile } = useMediaQueryContext()
  const { widths, setWidths } = useMessageListContext()
  const viewType = useAtomValue(viewTypeAtom)
  const user = useAtomValue(userAtom)
  const focusMessage = useAtomValue(focusMessageAtom)
  const { updateModelInfo } = useConversation()
  const { conversationId, modelInfo, messages } = conversation
  const widthItem = widths.find((item) => item.id === conversationId)
  const realtimeAudioRef = useRef<RealtimeAudioRef>(null)

  const isShowStopBtn = useMemo(() => {
    return modelInfo.atWork && !modelInfo.modelName.includes('realtime')
  }, [modelInfo.atWork, modelInfo.modelName])

  const switchToggle = (attr: 'disable') => {
    const value = !modelInfo[attr]
    updateModelInfo(conversationId, { [attr]: value })
    user?.isLogin && apiConversationsUpdate({ id: conversationId, modelInfo: { [attr]: value } })
  }

  const expandToggle = (forceExpanded?: boolean) => {
    if (widths.length <= 1 || isMobile) return

    const newWidths = [...widths]
    const itemIndex = newWidths.findIndex((item) => item.id === conversationId)

    if (itemIndex !== -1) {
      const expanded = forceExpanded !== undefined ? forceExpanded : !newWidths[itemIndex]!.expanded
      newWidths[itemIndex]!.expanded = expanded
      newWidths[itemIndex]!.width = expanded
        ? panelRef.current!.offsetWidth
        : newWidths[itemIndex]!.orignalWidth
      setWidths(newWidths)

      // 当展开时，让其自动滚动到可视区域
      if (expanded) {
        setTimeout(() => {
          const panel = panelRef.current
          const msgList = panel?.querySelector(
            `.conversation-item-wrapper[data-id="${conversationId}"]`
          )
          if (msgList) {
            msgList.scrollIntoView({ behavior: 'smooth', inline: 'end' })
          }
        }, 300)
      }
    }
  }

  const handleStopModel = () => {
    updateModelInfo(conversationId, { atWork: false })

    // 埋点 generation_stop
    const theMsg = messages.findLast((msg) =>
      [MessageState.loading, MessageState.start].includes(msg.state!)
    )
    const responseTimeMs = theMsg?.createdAt ? Date.now() - new Date(theMsg.createdAt).getTime() : 0
    gtag(
      'event',
      'generation_stop',
      enhanceEventParams({
        model_name: modelInfo.modelName,
        response_time_ms: responseTimeMs
      })
    )
  }

  // 监听跳转消息
  useEffect(() => {
    if (!focusMessage || focusMessage.conversationId !== conversation.conversationId) return
    const hasTarget = conversation.messages.some((msg) => msg.messageId === focusMessage.messageId)
    if (!hasTarget) return

    expandToggle(true)
  }, [conversation.conversationId, conversation.messages, focusMessage])

  return (
    <Box sx={{ ...customStyle.container }}>
      <Stack
        sx={{
          background: 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(8px)',
          zIndex: 1,
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: '100%',
          px: 'var(--spacing-xs)'
        }}
        direction="row"
        alignItems="center"
        spacing={2}
      >
        <Typography
          variant="body1"
          noWrap
          sx={{
            fontWeight: widthItem?.expanded ? 'bold' : 'normal',
            maxWidth: isMobile ? '50%' : 'none',
            cursor: widths.length > 1 ? 'pointer' : 'default'
          }}
          onClick={() => expandToggle()}
        >
          {modelInfo.alias || modelInfo.modelName}
        </Typography>

        {/* disable button */}
        <CSwitch checked={!modelInfo.disable} onChange={() => switchToggle('disable')} />

        {/* realtime button */}
        {modelInfo.modelName.includes('realtime') && (
          <RealtimeAudio
            ref={realtimeAudioRef}
            conversationId={conversationId}
            onClick={() => realtimeAudioRef.current?.startSession()}
            disabled={viewType !== ViewModel.normal || modelInfo.disable}
          />
        )}

        {/* more */}
        <Settings isVertical={true} conversationId={conversationId} />

        {isShowStopBtn && (
          <IconButton onClick={handleStopModel}>
            <StopIcon />
          </IconButton>
        )}
      </Stack>
    </Box>
  )
}

export default React.memo(MessageHeader)
