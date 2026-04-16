import type { MessageState, ModelCategory, ModelStatus, SendType } from '@constants'
import type { Op } from 'quill'

export type RoleType = 'user' | 'assistant'

export interface IModel {
  modelName: string
  isDefault?: boolean
  alias?: string
  provider?: string
  status?: ModelStatus
  category?: ModelCategory
  priority?: number
  replacedBy?: string
  jsonConfigRaw?: string // 原始 JSON 字符串，保留注释和格式
}

export interface IModelInfo extends IModel {
  atWork?: boolean // 模型是否工作中（回答中）
  disable?: boolean // 模型是否被禁用
  jsonConfig?: Record<string, unknown> // 模型 JSON 配置
}

export interface ContentBlock {
  type: 'text' | 'image' | 'file' | 'voice' | 'error' | 'files' | 'video'
  content: string

  file?: File
  fileKey?: string
  fileName?: string
  url?: string
  deltaOp?: Op
  temporary?: boolean // 是否为临时占位消息
}

export interface IMessage {
  role: RoleType // 消息角色
  content: ContentBlock[] // 消息内容
  model: string // 消息所属模型
  clientId: string // 客户端消息 id
  messageId?: string // 消息 id
  createdAt?: string // 消息创建时间
  updatedAt?: string // 消息修改时间
  state?: MessageState // 消息状态
  words?: number // 消息字数
  tokens?: number // 模型生成的 Token 数量
  totalTokens?: number // 输入 + 输出的总 Token 数量
  thoughtValue?: string // 思考内容
  annotations?: string[] // web search source
  cacheControl?: boolean // messages 缓存标识
  previousResponseId?: string // 历史上下文分叉点

  sendType?: SendType // 消息发送的方式(仅前端)
  basedId?: string // 消息是基于哪条用户消息的回答（assistant消息专属）
  isCurrentQuestion?: boolean // 是否当前提问问题(user消息专属)
}

export interface ITopics {
  id: string
  name: string
  models: string[]
  subUUID?: string
  order?: string
  version?: number
}

export interface IConversation {
  topicId: string
  conversationId: string
  modelId: string
  createdAt: string
  updatedAt: string
  messages: IMessage[]
  modelInfo: IModelInfo
  nextToken: string | null
  order?: string
  version?: number
}

export interface IMessageSearch {
  messageId: string
  conversationId: string
  topicId: string
  role: string
  model: string
  rawText: string
  createdAt: string
}
