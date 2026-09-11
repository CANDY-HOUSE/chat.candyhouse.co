import { useMediaQueryContext } from '@/context/MediaQueryContext'
import { useMessageListContext } from '@/context/MessageListContext'
import Settings from '@/features/common/Settings'
import RealtimeAudio, { type RealtimeAudioRef } from '@/features/media/RealtimeAudio'
import { useConversation } from '@/hooks/useConversation'
import { focusMessageAtom, UI_CONSTANTS, viewTypeAtom } from '@/store'
import type { IConversation } from '@/types/messagetypes'
import { enhanceEventParams, resolveConversationTitle } from '@/utils'
import { MessageState, ViewModel } from '@constants'
import StopIcon from '@mui/icons-material/Stop'
import { Box, IconButton, Stack, Typography } from '@mui/material'
import { useAtomValue } from 'jotai'
import React, { type FC, useEffect, useMemo, useRef } from 'react'

interface Props {
  conversation: IConversation
}

const customStyle = {
  container: {
    position: 'absolute',
    zIndex: 999,
    height: UI_CONSTANTS.messageHeaderHeight,
    width: '100%',
    left: 0,
    top: 0
  }
}

const MessageHeader: FC<Props> = ({ conversation }) => {
  const { isMobile } = useMediaQueryContext()
  const { widths, viewSwitch, setViewSwitch } = useMessageListContext()
  const viewType = useAtomValue(viewTypeAtom)
  const focusMessage = useAtomValue(focusMessageAtom)
  const { updateModelInfo } = useConversation()
  const { conversationId, modelInfo, messages } = conversation
  const realtimeAudioRef = useRef<RealtimeAudioRef>(null)

  const isShowStopBtn = useMemo(() => {
    return modelInfo.atWork && !modelInfo.modelName.includes('realtime')
  }, [modelInfo.atWork, modelInfo.modelName])

  // 标题点击：与新的"视图切换"按钮共用同一份 viewSwitch 状态（只做 normal⟷整屏 的快捷跳转，
  // 不参与 third/half 两档循环）。不是当前主控者时点击→抢占为整屏主控；已是主控者（任意档位）
  // 时点击自己的标题→collapse回 normal。forceExpanded 用于搜索跳转场景，始终强制跳到整屏。
  const expandToggle = (forceExpanded?: boolean) => {
    if (widths.length <= 1 || isMobile) return

    const isOwner = viewSwitch?.ownerId === conversationId

    if (forceExpanded || !isOwner) {
      setViewSwitch({ ownerId: conversationId, level: 'full' })
    } else {
      setViewSwitch(null)
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
          background: 'var(--header-overlay-bg)',
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
          title={resolveConversationTitle(modelInfo)}
          sx={{
            fontWeight: viewSwitch?.ownerId === conversationId ? 'bold' : 'normal',
            maxWidth: isMobile ? '50%' : 'none',
            cursor: widths.length > 1 ? 'pointer' : 'default'
          }}
          onClick={() => expandToggle()}
        >
          {resolveConversationTitle(modelInfo)}
        </Typography>

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
