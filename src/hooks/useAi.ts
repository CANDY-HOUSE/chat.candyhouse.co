import { apiStreamChat } from '@/api'
import { llmConfig } from '@/config'
import { userAtom } from '@/store'
import type { ModelProvider, StreamValue, UnifiedInput, UnifiedResponse } from '@/types/ai'
import type { ContentBlock, IMessage, IModelInfo } from '@/types/messagetypes'
import {
  ai,
  chat,
  enhanceEventParams,
  getLocalValue,
  localKey,
  putLocalValue,
  utils
} from '@/utils'
import { MessageState, SendType } from '@constants'
import { useAtomValue } from 'jotai'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useConversation } from './useConversation'
import { useMessage } from './useMessage'
import { useModel } from './useModel'

export const useAi = () => {
  const { t } = useTranslation()
  const user = useAtomValue(userAtom)

  const { toAiRequest } = useMessage()
  const { getConversation, pushMessage, getAttrValue, updateModelInfo, updateMessage } =
    useConversation()
  const { getModelName } = useModel()

  /** 检查用户是否主动中止回答
   * @param conversationId 会话id
   * @param message 待发送消息
   * @param abortController 中止控制器
   * @param modelRes 模型回答内容
   * @param modelThought 模型思考内容
   * @param topicId 主题id
   * @returns 是否已中止
   */
  const checkAbortAndPushFinal = (
    conversationId: string,
    message: IMessage,
    abortController: AbortController,
    modelRes: string | ContentBlock[],
    modelThought?: string,
    topicId?: string
  ): boolean => {
    if (abortController.signal.aborted) return true

    const modelInfoRealTime = getAttrValue(conversationId, 'modelInfo', topicId)
    if (!modelInfoRealTime?.atWork) {
      abortController.abort()
      handlePushMessage(conversationId, message, {
        content: Array.isArray(modelRes) ? [...modelRes] : modelRes,
        thoughtValue: modelThought,
        status: MessageState.finish,
        topicId
      })
      return true
    }

    return false
  }

  /**
   * 处理文本类型的注释
   */
  const processTextAnnotations = (
    message: IMessage,
    annotations: Array<{ url?: string; uri?: string; title?: string }>
  ) => {
    const annotationsIcons: Array<string> = []

    if (annotations.length > 0) {
      annotations.forEach((annotation) => {
        const sourceUrl = annotation.url || annotation.uri
        if (!sourceUrl) return

        const url = utils.getFaviconUrl(
          sourceUrl,
          'uri' in annotation ? annotation.title : undefined
        )
        if (!url || annotationsIcons.includes(url)) return
        annotationsIcons.push(url)
      })
      message.annotations = annotationsIcons
    }
  }

  /**
   * 处理流式响应的数据块
   */
  const processStreamValue = async (
    value: StreamValue,
    modelRes: ContentBlock[],
    message: IMessage,
    options?: { aspectRatio?: string }
  ) => {
    // 处理字符串类型（纯文本）
    if (typeof value === 'string' && value.length > 0) {
      const textBlock = chat.createContentBlock(value, 'text')
      modelRes.push(textBlock)
      return
    }

    // 处理数组类型（text/image/video）
    if (Array.isArray(value)) {
      for (const item of value) {
        switch (item.type) {
          case 'text': {
            const annotations = item.annotations || []
            processTextAnnotations(message, annotations)
            break
          }

          case 'image': {
            const imgBlock = await chat.createImgBlock(
              {
                insert: {
                  image: item.url
                }
              },
              item.name
            )
            modelRes.push(imgBlock)
            break
          }

          case 'video': {
            const { progress, url } = item
            const { aspectRatio = '16/9' } = options || {}

            // 清空之前的内容，只保留最新的视频状态
            modelRes.length = 0

            if (progress < 100) {
              modelRes.push({
                type: 'video',
                content: `<video src="" data-progress="${progress}" data-aspect-ratio="${aspectRatio}"></video>`,
                url: ''
              })
            } else {
              modelRes.push({
                type: 'video',
                content: `<video src="${url}" data-md-allow="video" controls autoPlay loop data-progress="${progress}" data-aspect-ratio="${aspectRatio}"></video>`,
                url
              })
            }
            break
          }
        }
      }
    }
  }

  /**
   * 构建厂商参数
   * @param modelProvider 模型提供商
   * @param jsonConfig 用户的 JSON 配置
   * @param runtimeParams 运行时生成的参数（特殊处理的字段）
   * @returns 最终的 providerParams
   */
  const buildProviderParams = (
    modelProvider: ModelProvider,
    jsonConfig: Record<string, unknown> | undefined,
    runtimeParams: Record<string, unknown> = {}
  ): Partial<Record<ModelProvider, unknown>> => {
    const specialFields = new Set(Object.keys(runtimeParams))

    // 移除用户配置中的特殊字段
    const userConfig = Object.keys(jsonConfig || {})
      .filter((key) => !specialFields.has(key))
      .reduce(
        (obj, key) => {
          obj[key] = jsonConfig![key]
          return obj
        },
        {} as Record<string, unknown>
      )

    return {
      [modelProvider]: {
        ...runtimeParams,
        ...userConfig
      }
    }
  }

  /**
   * 多模态处理策略的上下文参数
   */
  interface ModalityContext {
    conversationId: string
    message: IMessage
    messages: UnifiedInput[]
    modelInfo: IModelInfo
    basedId: string
    topicId?: string
  }

  /**
   * 多模态处理策略接口
   */
  interface ModalityStrategy {
    execute(context: ModalityContext): Promise<void>
  }

  /**
   * 根据模型能力选择合适的处理策略
   */
  const selectModalityStrategy = (model: string): ModalityStrategy => {
    // 优先级：Video > Response API > Chat Completion/Image
    if (ai.supportsVideoGeneration(model)) {
      return {
        execute: async (ctx) => {
          await handleVideoGeneration(ctx.conversationId, {
            message: ctx.message,
            modelInfo: ctx.modelInfo,
            basedId: ctx.basedId,
            topicId: ctx.topicId
          })
        }
      }
    }

    if (ai.supportsResponseAPI(model)) {
      return {
        execute: async (ctx) => {
          await handleResponseApi(ctx.conversationId, {
            messages: ctx.messages,
            message: ctx.message,
            modelInfo: ctx.modelInfo,
            topicId: ctx.topicId
          })
        }
      }
    }

    // 默认使用 Chat Completion
    return {
      execute: async (ctx) => {
        await handleChatCompletion(ctx.conversationId, {
          messages: ctx.messages,
          message: ctx.message,
          modelInfo: ctx.modelInfo,
          topicId: ctx.topicId
        })
      }
    }
  }

  /**
   * 模型回答处理
   * @param conversationId 会话id
   * @param message 待发送消息
   * @param extra 其他参数 包括：消息内容/思维链内容/消息状态/主题id/等
   */
  const handlePushMessage = useCallback(
    (
      conversationId: string,
      message: IMessage,
      extra: {
        content: string | ContentBlock[]
        status: number // 0: load 1: finish -1: start -2: err
        thoughtValue?: string
        previousResponseId?: string
        topicId?: string
        usages?: UnifiedResponse['usage']
      }
    ) => {
      const { content, thoughtValue, status, previousResponseId, topicId, usages } = extra
      const isEnd = [MessageState.finish, MessageState.error].includes(status)

      message.state = status
      message.content = typeof content === 'string' ? [chat.createContentBlock(content)] : content
      message.thoughtValue = thoughtValue
      message.previousResponseId = previousResponseId

      if (status === MessageState.finish || status === MessageState.error) {
        // 更新会话消息token和字数信息
        if (usages) {
          message.tokens = usages.outputTokens
          message.totalTokens = usages.totalTokens
        }
        message.words = chat.countContentBlocksChars(message.content)

        // 埋点 model_response
        if (message.sendType !== SendType.refresh) {
          const responseTimeMs = message.createdAt
            ? Date.now() - new Date(message.createdAt).getTime()
            : 0
          gtag(
            'event',
            'model_response',
            enhanceEventParams({
              model_name: message.model,
              status: status === MessageState.finish ? 'success' : 'error',
              output_chars: chat.countContentBlocksChars(message.content),
              response_time_ms: responseTimeMs
            })
          )
        }
      }

      pushMessage(conversationId, message, { isEnd, topicId })
    },
    [pushMessage]
  )

  /**
   * 处理生成视频
   * @param conversationId 会话id
   * @param extra { prompt: 关于对视频内容的描述 message: 待发送消息 modelInfo: 模型配置 basedId: 基于的消息id topicId?: 主题id }
   */
  const handleVideoGeneration = async (
    conversationId: string,
    extra: {
      message: IMessage
      modelInfo: IModelInfo
      basedId: string
      topicId?: string
    }
  ) => {
    const { message, modelInfo, topicId, basedId } = extra
    let chatStatus = MessageState.loading
    let modelRes: ContentBlock[] = []
    const abortController = new AbortController()
    const model = getModelName(modelInfo.modelName)
    const modelProvider = ai.getModelProvider(model)
    const conv = getConversation(conversationId, topicId)
    const baseMsg = conv?.messages.find((msg) => msg.clientId === basedId)

    let prompt = ''
    let inputReferenceKey: string | undefined

    // 从用户输入中提取 prompt 和图片
    if (baseMsg) {
      for (const block of baseMsg.content) {
        if (block.type === 'text') {
          prompt += block.content
        } else if (block.type === 'image') {
          if (!block.url) continue
          inputReferenceKey = block.url.replace(chat.fileUrlFactory(''), '')
        }
      }
    }

    // 构建运行时参数（特殊处理的字段）
    const runtimeParams: Record<string, unknown> = {}

    if (inputReferenceKey) {
      switch (modelProvider) {
        case 'OpenAI':
          runtimeParams.input_reference = inputReferenceKey
          break
        case 'Google':
          runtimeParams.image = { imageBytes: inputReferenceKey }
          break
      }
    }

    // 使用通用函数构建最终参数
    const providerParams = buildProviderParams(modelProvider, modelInfo.jsonConfig, runtimeParams)

    const options = {
      prompt,
      providerParams,
      email: user?.email
    }

    await apiStreamChat<StreamValue>(model, options, abortController, async (data) => {
      if (data.error) {
        throw new Error(data.error as string)
      }

      if (checkAbortAndPushFinal(conversationId, message, abortController, modelRes, '', topicId)) {
        return
      }

      // 更新状态
      chatStatus = data.done ? MessageState.finish : MessageState.start

      // 处理响应数据
      await processStreamValue(data.value, modelRes, message)

      if (modelRes.length === 0) return

      handlePushMessage(conversationId, message, {
        content: [...modelRes],
        status: chatStatus,
        topicId
      })
    })
  }

  /**
   * response api 请求
   * @param conversationId 会话id
   * @param extra { messages: 转换后的会话列表 message: 待发送消息 modelInfo: 模型配置 topicId?: 主题id }
   */
  const handleResponseApi = async (
    conversationId: string,
    extra: {
      messages: UnifiedInput[]
      message: IMessage
      modelInfo: IModelInfo
      topicId?: string
    }
  ) => {
    const { messages, message, modelInfo, topicId } = extra
    let chatStatus = MessageState.loading
    const abortController = new AbortController() // chat abort controller
    let modelRes: ContentBlock[] = [] // 模型的回答
    let modelThought: string = '' // 模型的思考
    const model = getModelName(modelInfo.modelName)
    const modelProvider = ai.getModelProvider(model)
    const conv = getConversation(conversationId, topicId)
    const filteMessages = messages.findLast((item) => item.role === 'user')!

    // 历史上下文管理
    let pId: string | null = null
    const msgIndex = conv?.messages.findIndex((msg) => msg.clientId === message.clientId) || -1
    if (msgIndex > 1) {
      pId =
        conv?.messages.slice(0, msgIndex).findLast((msg) => !!msg.previousResponseId)
          ?.previousResponseId || null
    }

    // 构建运行时参数（特殊处理的字段）
    const runtimeParams: Record<string, unknown> = {
      previous_response_id: pId
    }

    // 使用通用函数构建最终参数
    const providerParams = buildProviderParams(modelProvider, modelInfo.jsonConfig, runtimeParams)

    const options = {
      messages: [filteMessages],
      maxTokens: llmConfig.OpenAI.maxTokens,
      providerParams,
      email: user?.email
    }

    await apiStreamChat<StreamValue>(model, options, abortController, async (data) => {
      if (data.error) {
        throw new Error(data.error as string)
      }

      // 处理 refusal
      if (data.finishReason === 'refusal') {
        throw new Error(t('refusal'))
      }

      // 处理中止
      if (
        checkAbortAndPushFinal(
          conversationId,
          message,
          abortController,
          modelRes,
          modelThought,
          topicId
        )
      ) {
        return
      }

      // 更新状态
      let previousResponseId = (data.extra?.responseId || '') as string
      chatStatus = data.done ? MessageState.finish : MessageState.start
      modelThought += data.thoughtValue ?? ''

      // 处理响应数据
      await processStreamValue(data.value, modelRes, message)

      if (modelRes.length === 0) return

      handlePushMessage(conversationId, message, {
        content: [...modelRes],
        thoughtValue: modelThought,
        status: chatStatus,
        previousResponseId,
        topicId,
        usages: data.usage
      })
    })
  }

  /**
   * chat completion 请求
   * @param conversationId 会话id
   * @param extra { messages: 转换后的会话列表 message: 待发送消息 modelInfo: 模型配置 topicId?: 主题id }
   */
  const handleChatCompletion = async (
    conversationId: string,
    extra: {
      messages: UnifiedInput[]
      message: IMessage
      modelInfo: IModelInfo
      topicId?: string
    }
  ) => {
    const { messages, message, modelInfo, topicId } = extra
    let chatStatus = MessageState.loading
    const abortController = new AbortController() // chat abort controller
    let modelRes: ContentBlock[] = [] // 模型的回答
    let modelThought: string = '' // 模型的思考
    const model = getModelName(modelInfo.modelName)
    const modelProvider = ai.getModelProvider(model)

    // 使用通用函数构建最终参数
    const providerParams = buildProviderParams(modelProvider, modelInfo.jsonConfig)

    const options = {
      messages,
      maxTokens: llmConfig[modelProvider].maxTokens,
      providerParams,
      email: user?.email
    }

    await apiStreamChat<StreamValue>(model, options, abortController, async (data) => {
      if (data.error) {
        throw new Error(data.error as string)
      }

      // 处理 refusal
      if (data.finishReason === 'refusal') {
        throw new Error(t('refusal'))
      }

      if (
        checkAbortAndPushFinal(
          conversationId,
          message,
          abortController,
          modelRes,
          modelThought,
          topicId
        )
      ) {
        return
      }

      // 更新状态
      chatStatus = data.done ? MessageState.finish : MessageState.start
      modelThought += data.thoughtValue ?? ''

      // 处理响应数据
      await processStreamValue(data.value, modelRes, message)

      if (modelRes.length === 0) return

      handlePushMessage(conversationId, message, {
        content: [...modelRes],
        thoughtValue: modelThought,
        status: chatStatus,
        topicId,
        usages: data.usage
      })
    })
  }

  /**
   * 向模型发送消息
   * @param conversationId 会话id
   * @param clientId 客户端消息 id
   * @param toBeSendMsg 待发送消息
   * @returns
   */
  const handleSendMessage = async (
    conversationId: string,
    message: IMessage,
    toBeSendMsg: IMessage,
    topicId?: string
  ) => {
    try {
      const sendType = toBeSendMsg.sendType || SendType.normal

      // push 用户消息
      if (sendType === SendType.normal) {
        message.words = chat.countContentBlocksChars(message.content)
        pushMessage(conversationId, message, { topicId })
      }

      const modelInfo = getAttrValue(conversationId, 'modelInfo', topicId)
      if (!modelInfo) {
        throw new Error('Model info not found')
      }

      const model = getModelName(modelInfo.modelName)
      const [messages, basedId] = toAiRequest(conversationId, message.clientId, sendType, topicId)
      if (!messages) throw new Error('Messages info not found')

      // push 模型消息
      pushMessage(conversationId, toBeSendMsg, { topicId, isEnd: false })
      updateModelInfo(conversationId, { atWork: true }, topicId)

      const strategy = selectModalityStrategy(model)
      await strategy.execute({
        conversationId,
        message: toBeSendMsg,
        messages,
        modelInfo,
        basedId,
        topicId
      })
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (error.name === 'AbortError') {
        return
      }

      pushMessage(
        conversationId,
        {
          ...toBeSendMsg,
          state: MessageState.error,
          content: [chat.createContentBlock(errorMessage)]
        },
        { topicId }
      )
    }
  }

  /**
   * 发送消息
   * @param conversationId 会话id
   * @param message 消息体
   */
  const sendMessage = useCallback(
    (
      conversationId: string,
      message: IMessage,
      options?: Partial<{ sendType: SendType; topicId: string }>
    ) => {
      const { sendType = SendType.normal, topicId } = options || {}
      const toBeSendMsg = chat.createTplMsg(message.model, 'assistant', sendType) // 待发送消息模版

      if (sendType === SendType.refresh) {
        if (message.role === 'assistant') {
          // 刷新模型消息
          toBeSendMsg.clientId = message.clientId
          toBeSendMsg.messageId = message.messageId
        }
        if (message.role === 'user') {
          // 刷新用户消息
          toBeSendMsg.basedId = message.messageId
          updateMessage(conversationId, message.messageId!, { isCurrentQuestion: true })
        }
      }

      handleSendMessage(conversationId, message, toBeSendMsg, topicId)
    },
    [user?.isLogin, updateMessage, t]
  )

  // 重置发送消息次数
  const resetSendCountDaily = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10)
    const lastReset = getLocalValue(localKey.limitCountLastReset)

    if (lastReset !== today && !user?.isLogin) {
      putLocalValue(localKey.limitCount, 0)
      putLocalValue(localKey.limitCountLastReset, today)
    }
  }, [user?.isLogin])

  return {
    resetSendCountDaily,
    sendMessage
  }
}
