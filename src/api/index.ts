import type { UnifiedResponse } from '@/types/ai'
import type { BeanUser } from '@/types/beantypes'
import type {
  IConversation,
  IMessage,
  IMessageSearch,
  IModel,
  IModelInfo,
  ITopics
} from '@/types/messagetypes'
import { clearAllLocalStorage } from '@/utils'
import { Signer } from '@aws-amplify/core'
import { config } from '@config'
import { Auth } from 'aws-amplify'
import i18n from '../i18n'
import { hideLoading, showLoading } from '../store'
import { api } from './http'

interface LoadingOptions {
  enableLoading?: boolean
}

const withLoading = <T extends (...args: never[]) => Promise<any>>(
  fn: T,
  options: LoadingOptions = {}
): T => {
  const { enableLoading = true } = options

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    if (!enableLoading) {
      return fn(...args)
    }

    showLoading()
    try {
      return await fn(...args)
    } finally {
      hideLoading()
    }
  }) as T
}

// 用户登录鉴权相关 start -- 包含注册、登录、登出、获取用户信息
export const apiLogin = withLoading(async (email: string) => {
  try {
    const result = await Auth.signIn(email)
    return { isOk: true, data: result }
  } catch (e: unknown) {
    if (e instanceof Error) {
      if (e.name === 'NotAuthorizedException') {
        await Auth.signUp({
          username: email,
          password: 'TempPass123!',
          attributes: {
            email: email
          }
        })
        const signInResult = await Auth.signIn(email)
        return { isOk: true, data: signInResult }
      }
    }

    return { isOk: false, data: null }
  }
})

export const apiAuth = withLoading(async (user: unknown, code: string) => {
  const result = await Auth.sendCustomChallengeAnswer(user, code)
  return result.signInUserSession ? { isOk: true, data: result } : { isOk: false }
})

export const apiAuthToken = withLoading(async (): Promise<BeanUser> => {
  try {
    const user = await Auth.currentAuthenticatedUser()
    const username = user.attributes.nickname
    const email = user.attributes.email
    return { name: username, email: email, isLogin: true }
  } catch {
    return { name: '', email: '', isLogin: false }
  }
})

export const apiLogout = withLoading(
  async () => {
    await Auth.signOut()
    clearAllLocalStorage()
    gtag('set', {
      user_id: null
    })
  },
  { enableLoading: false }
)
// 用户登录鉴权相关 end

export const apiPostRealtimeSession = withLoading(
  async (model: string, options: Record<string, unknown> = {}) => {
    try {
      const result = await api.post<{ client_secret: { value: string } }>(
        `${config.apiPaths.model}/realtime`,
        {
          model,
          ...options
        }
      )
      return result.data
    } catch {
      return null
    }
  }
)

// 获取 modle select
export const apiGetModelSelect = withLoading(
  async (
    queryType: 'all' | 'status' | 'provider' | 'category' = 'all',
    param?: {
      provider?: string
      status?: string
      category?: string
      sortOrder?: 'asc' | 'desc'
    }
  ) => {
    try {
      const result = await api.get<{ items: Array<IModel>; count: number }>(
        `${config.apiPaths.select}/model`,
        { queryType, ...param }
      )
      return result.data
    } catch {
      return null
    }
  }
)

// 创建话题
export const apiTopicsCreate = withLoading(async (name: string) => {
  try {
    const result = await api.post(`${config.apiPaths.topics}`, {
      name
    })
    return result.success
  } catch {
    return false
  }
})

// 获取话题列表
export const apiTopicsGet = withLoading(async () => {
  try {
    const result = await api.get<Array<ITopics>>(`${config.apiPaths.topics}`)
    return result.data
  } catch {
    return []
  }
})

// 修改话题
export const apiTopicsUpdate = withLoading(
  async (param: { id: string; name?: string; models?: string[] }) => {
    try {
      const result = await api.put(`${config.apiPaths.topics}`, param)
      return result.success
    } catch {
      return false
    }
  }
)

// 删除话题
export const apiTopicsDelete = withLoading(async (id: string) => {
  try {
    const result = await api.delete(`${config.apiPaths.topics}`, { id })
    return result.success
  } catch {
    return false
  }
})

// 话题排序
export const apiTopicMove = withLoading(
  async (param: {
    targetTopicId: string
    beforeTopicId?: string
    afterTopicId?: string
    expectedVersion?: number
  }) => {
    try {
      const result = await api.post<{ order: string; version: number }>(
        `${config.apiPaths.topics}/move`,
        { ...param }
      )

      return result.data
    } catch {
      return false
    }
  }
)

// 创建会话
export const apiConversationsCreate = withLoading(
  async (param: { topicId: string; modelName: string }) => {
    try {
      const result = await api.post<{ order: string; conversationId: string; version: number }>(
        `${config.apiPaths.conversations}`,
        param
      )

      return result.success
    } catch {
      return false
    }
  }
)

// 删除会话
export const apiConversationsDelete = withLoading(
  async (param: { topicId: string; modelId: string }) => {
    try {
      const result = await api.delete<{
        topicId: string
        modelId: string
        message: string
        deletedItem?: unknown
      }>(`${config.apiPaths.conversations}`, param)
      return result.success
    } catch {
      return false
    }
  }
)

// 修改会话
export const apiConversationsUpdate = withLoading(
  async (param: { id: string; modelInfo: Partial<IModelInfo> }) => {
    try {
      const result = await api.put(`${config.apiPaths.conversations}`, param)
      return result.success
    } catch {
      return false
    }
  },
  { enableLoading: false }
)

// 获取会话列表
export const apiConversationsGet = withLoading(async (topicId: string) => {
  try {
    const result = await api.get<Array<IConversation>>(`${config.apiPaths.conversations}`, {
      topicId
    })
    return result.data
  } catch {
    return []
  }
})

// 会话排序
export const apiConversationMove = withLoading(
  async (
    topicId: string,
    param: {
      targetModelId: string
      beforeModelId?: string
      afterModelId?: string
      expectedVersion?: number
    }
  ) => {
    try {
      const result = await api.post<{ order: string; version: number }>(
        `${config.apiPaths.conversations}/move`,
        {
          topicId,
          ...param
        }
      )

      return result.data
    } catch {
      return null
    }
  }
)

// 创建消息
export const apiMessagesCreate = withLoading(
  async (param: {
    body: IMessage & { topicId: string; uuid: string | null }
    conversationId: string
    afterMessageId?: string
  }) => {
    try {
      const result = await api.post<{
        conversationId: string
        createdAt: string
        messageId: string
      }>(`${config.apiPaths.messages}`, param)
      return result.data
    } catch {
      return null
    }
  },
  { enableLoading: false }
)

// 获取消息
export const apiMessagesGet = withLoading(
  async (param: {
    id: string
    limit?: number
    nextToken?: string
    preAnchorTimestamp?: string
    nextAnchorTimestamp?: string
  }) => {
    try {
      const result = await api.get<{ messages: Array<IMessage>; nextToken: string | null }>(
        `${config.apiPaths.messages}`,
        param
      )
      return result.data
    } catch {
      return null
    }
  }
)

// 删除消息
export const apiMessagesDelete = withLoading(async (conversationId: string, messageId?: string) => {
  try {
    const result = await api.delete(`${config.apiPaths.messages}`, {
      id: conversationId,
      ...(messageId && { messageId })
    })
    return result.success
  } catch {
    return false
  }
})

// 修改消息
export const apiMessagesUpdate = withLoading(
  async (conversationId: string, messageId: string, options: Partial<IMessage>) => {
    try {
      const result = await api.put(`${config.apiPaths.messages}`, {
        conversationId,
        messageId,
        ...options
      })
      return result.success
    } catch {
      return false
    }
  }
)

// 搜索消息
export const apiMessagesSearch = withLoading(
  async (param: { keywords: string; topicId?: string; limit?: number }) => {
    try {
      const result = await api.get<{
        data: Array<IMessageSearch>
        meta: { count: number; query: string }
      }>(`${config.apiPaths.messages}/search`, param)
      return result.data
    } catch {
      return null
    }
  }
)

// 流式聊天接口
export const apiStreamChat = withLoading(
  async <V>(
    model: string | Array<string>,
    options: any,
    abortController?: AbortController,
    onChunk?: (chunk: UnifiedResponse<V>) => Promise<void>
  ) => {
    const { email, ...opts } = options
    const url = 'https://m3mkslh7a747nrrkjjje57bwh40qstqg.lambda-url.ap-northeast-1.on.aws/'
    const res = await lambdaUrlInvoke(
      url,
      { model, options: opts, email },
      { signal: abortController?.signal }
    )

    for await (const data of parseSSE(res)) {
      if (data?.end) break

      await onChunk?.(data)
    }
  },
  { enableLoading: false }
)

async function* parseSSE(response: Response) {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        // 处理最后的残留数据
        if (buffer.trim()) {
          yield parseMessage(buffer)
        }
        break
      }

      // 累积数据
      buffer += decoder.decode(value, { stream: true })

      // 按 \n\n 分割
      const messages = buffer.split('\n\n')

      // 最后一个可能不完整，留在 buffer
      buffer = messages.pop() || ''

      // 处理完整的消息
      for (const msg of messages) {
        if (msg.trim()) {
          yield parseMessage(msg)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function parseMessage(msg: string) {
  if (msg.startsWith('data: ')) {
    const jsonStr = msg.substring(6)
    if (jsonStr === '[DONE]') {
      return { end: true }
    }
    return JSON.parse(jsonStr)
  }
  return null
}

async function lambdaUrlInvoke(
  url: string,
  params: Record<string, unknown>,
  options: Record<string, unknown> = {}
) {
  try {
    const region = process.env.REACT_APP_API_REGION || 'ap-northeast-1'

    // 构建请求 body
    const requestBody = JSON.stringify(params)
    const request = {
      method: 'POST',
      url,
      headers: {
        'Content-Type': 'application/json'
      },
      data: requestBody
    }

    // 构建 AWS Signature V4 签名
    const credentials = await Auth.currentCredentials()
    const signedRequest = Signer.sign(
      request,
      {
        access_key: credentials.accessKeyId,
        secret_key: credentials.secretAccessKey,
        session_token: credentials.sessionToken
      },
      {
        service: 'lambda',
        region
      }
    )

    const response = await fetch(url, {
      method: 'POST',
      headers: signedRequest.headers as HeadersInit,
      body: requestBody,
      ...options
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText)
    }

    return response
  } catch {
    throw new Error(i18n.t('corporateUserOnly'))
  }
}
