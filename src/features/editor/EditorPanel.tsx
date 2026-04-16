import { useMediaQueryContext } from '@/context/MediaQueryContext'
import { useAi } from '@/hooks/useAi'
import { useConversation } from '@/hooks/useConversation'
import { useMessage } from '@/hooks/useMessage'
import { useModel } from '@/hooks/useModel'
import {
  checkedConversationsAtom,
  editorExpandedAtom,
  editorHeightAtom,
  store,
  switchToast,
  UI_CONSTANTS,
  workingModelsAtom
} from '@/store'
import { type ContentBlock, type IMessage } from '@/types/messagetypes'
import { ai, chat, enhanceEventParams } from '@/utils'
import { MessageState } from '@constants'
import { Box } from '@mui/material'
import { useAtomValue } from 'jotai'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import EditorPanelInner from './EditorPanelInner'

const EditorPanel = () => {
  const { t } = useTranslation()
  const { isMobile } = useMediaQueryContext()
  const workingModels = useAtomValue(workingModelsAtom)
  const editorH = useAtomValue(editorHeightAtom)
  const editorExpanded = useAtomValue(editorExpandedAtom)
  const conversations = useAtomValue(checkedConversationsAtom)
  const { getAttrValue, applyCacheControlWithAccurateTokens } = useConversation()
  const { uploadFiles } = useMessage()
  const { sendMessage } = useAi()
  const { getModelName } = useModel()

  const pendingMsgQueueRef = useRef<Map<string, IMessage[]>>(new Map())
  const prevWorkingModelsRef = useRef<typeof workingModels>([])
  const sendMessageRef = useRef(sendMessage)

  useEffect(() => {
    sendMessageRef.current = sendMessage
  }, [sendMessage])

  const editorHeight = useMemo(() => {
    if (editorExpanded) return '50%'
    if (isMobile) return UI_CONSTANTS.mobileEditorHeight
    return `${editorH}px`
  }, [isMobile, editorH, editorExpanded])

  // 手动发送消息处理
  const manualSendFn = useCallback(
    (cId: string, message: IMessage) => {
      const queue = pendingMsgQueueRef.current

      if (queue.has(cId)) {
        queue.get(cId)?.push(message)
        return
      }

      if (workingModels?.some((item) => item.id === cId)) {
        queue.set(cId, [message])
        return
      }

      const convAtom = conversations.find((conv) => conv.id === cId)!
      const conv = store.get(convAtom.atom)
      const tId = conv.topicId
      sendMessageRef.current(cId, message, { topicId: tId })
    },
    [workingModels, conversations]
  )

  const handleSubmit = useCallback(
    async (blocks?: ContentBlock[] | null) => {
      if (!blocks || blocks.length < 1) return

      // 排除 realtime
      const convs = conversations.filter(({ atom }) => {
        const conv = store.get(atom)
        return !conv.modelInfo.modelName.includes('realtime')
      })

      if (!convs || convs.length < 1) {
        switchToast({ visible: true, message: t('noOpenModel') })
        return
      }

      // 模型待发送消息
      const modeslMsg = new Map<string, IMessage>()
      let processedBlocks = blocks

      // 初始化所有会话的消息
      const convsOriginal = convs.map(({ atom }) => store.get(atom))
      for (const { atom } of convs) {
        const conv = store.get(atom)
        const modelInfo = getAttrValue(conv.conversationId, 'modelInfo')
        if (!modelInfo || modelInfo.disable) continue
        const model = getModelName(modelInfo.modelName)

        let message = chat.createTplMsg(model, 'user')
        message.model = model
        message.content = processedBlocks
        message.state = MessageState.start
        message.isCurrentQuestion = true

        // 更新对应消息列表
        modeslMsg.set(conv.conversationId, message)
      }

      // 检查是否有文件
      const hasFile = blocks.some((item) => item.type !== 'text')

      // 如果有文件，上传文件
      if (hasFile) {
        processedBlocks = await uploadFiles(blocks)

        // 检查是否有上传失败的文件
        const failedBlocks = processedBlocks.filter((item) => item.type === 'error')

        // 更新消息状态
        for (let [conversationId, message] of modeslMsg) {
          message.content = processedBlocks
          message.state = failedBlocks.length > 0 ? MessageState.error : MessageState.finish

          if (failedBlocks.length > 0) {
            message.content = failedBlocks
          }

          manualSendFn(conversationId, message)
        }
      } else {
        // 纯文本消息处理
        for (let [conversationId, message] of modeslMsg) {
          message.content = processedBlocks
          message.state = MessageState.finish

          // 缓存策略（目前只适配了 claude）
          const modelInfo = getAttrValue(conversationId, 'modelInfo')
          if (!modelInfo || modelInfo.disable) continue
          const model = getModelName(modelInfo.modelName)
          if (ai.getModelProvider(model) === 'Anthropic') {
            const msg = await applyCacheControlWithAccurateTokens(conversationId, message)
            message = msg ?? message
          }

          manualSendFn(conversationId, message)
        }
      }

      // 埋点 chat_send
      const activeList = convsOriginal
        .filter((conv) => conv.modelInfo && !conv.modelInfo.disable)
        .map((conv) => conv.modelInfo.modelName)
        .sort()
        .join(',')
      const standbyList = convsOriginal
        .filter((conv) => conv.modelInfo && conv.modelInfo.disable)
        .map((conv) => conv.modelInfo.modelName)
        .sort()
        .join(',')
      gtag(
        'event',
        'chat_send',
        enhanceEventParams({
          // 维度参数
          model_combo: activeList,
          standby_models: standbyList,
          // search_active_models: websearchActiveList,

          // 指标参数
          active_count: convsOriginal.length,
          input_chars: chat.countContentBlocksChars(blocks)
        })
      )
    },
    [
      conversations,
      t,
      getAttrValue,
      getModelName,
      uploadFiles,
      manualSendFn,
      applyCacheControlWithAccurateTokens
    ]
  )

  // 待发送消息队列循环
  useEffect(() => {
    const prevModels = prevWorkingModelsRef.current
    prevWorkingModelsRef.current = [...workingModels]

    const disappearedModel = prevModels.find(
      (prevModel) => !workingModels.some((model) => model.id === prevModel.id)
    )

    if (disappearedModel && pendingMsgQueueRef.current.size > 0) {
      const conv = store.get(disappearedModel.atom)
      const tId = conv.topicId
      const cId = disappearedModel.id
      const queue = pendingMsgQueueRef.current
      const msgs = queue.get(cId)
      if (!msgs || msgs.length === 0) return

      const message = msgs.shift()!
      if (msgs.length === 0) queue.delete(cId)

      setTimeout(() => {
        sendMessageRef.current(cId, message, { topicId: tId })
      }, 0)
    }
  }, [workingModels])

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        flex: 'none',
        pb: {
          xs: 'env(safe-area-inset-bottom)'
        },
        transition: 'height .2s',
        height: editorHeight
      }}
    >
      <EditorPanelInner submitFn={handleSubmit} />
    </Box>
  )
}

export default React.memo(EditorPanel)
