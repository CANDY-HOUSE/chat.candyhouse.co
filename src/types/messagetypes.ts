import type { MessageState, ModelCategory, ModelStatus, SendType } from '@constants'
import type { Op } from 'quill'

export type RoleType = 'user' | 'assistant'

export interface IModel {
  modelName: string
  alias?: string
  isDefault?: boolean
  provider?: string
  status?: ModelStatus
  category?: ModelCategory
  priority?: number
  replacedBy?: string
  supersedes?: string // PREVIEW 行回指其将替代的基线 modelName（promote 据此定位旧行）
  updatedBy?: string // 最后更新者："scout"（Scout 写 PREVIEW）或 owner 邮箱（人工 promote）
  updatedAt?: string
}

// 会话级配置：用户可编辑，与模型注册表无关。后续会话级字段都加这里——
// 生成、合并、持久化、预览会自动生效。
export interface IConversationConfig {
  name?: string // 用户自定义会话显示名；缺省回退 alias / modelName
}

export interface IModelInfo extends IModel {
  atWork?: boolean // 模型是否工作中（回答中）
  disable?: boolean // 模型是否被禁用
  jsonConfig?: {
    settings?: Record<string, unknown> // L1 采样参数
    providerOptions?: Record<string, unknown> // L2 厂商私货参数
    tools?: Record<string, unknown> // 可用工具配置
  } // 模型 JSON 配置
  convConfig?: IConversationConfig // 会话级配置，与 jsonConfig 平级命名空间
  userNL?: string // 用户输入的自然语言
}

/* config-gen 域契约放在 types 而非 features，避免 api → features 反向依赖 */
export interface ConfigDomainMap {
  // 新增 domain 只需在这里加一行
  model: NonNullable<IModelInfo['jsonConfig']>
  conversation: IConversationConfig
}

export type ConfigDomain = keyof ConfigDomainMap

export interface ConfigGenExplanation {
  kind: 'applied' | 'ignored' | 'assumption'
  message: string
  path?: string
}

export interface ConfigGenResult<D extends ConfigDomain = ConfigDomain> {
  config: ConfigDomainMap[D]
  explanations: ConfigGenExplanation[]
}

export interface ConfigGenDomainResult<
  D extends ConfigDomain = ConfigDomain
> extends ConfigGenResult<D> {
  domain: D
}

/** POST /model/config-gen 的响应体：永远是数组，无论后端走分类路径（可能命中多个 domain）
 *  还是显式单 domain 路径（数组恒为 1 项）——调用方只需处理一种形状。 */
export interface ConfigGenResponse {
  results: ConfigGenDomainResult[]
}

export interface ContentBlock {
  type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'tool-call' | 'tool-result' | 'error'
  content: string

  file?: File
  fileKey?: string
  fileName?: string
  url?: string
  deltaOp?: Op
  temporary?: boolean // 是否为临时占位消息
  thoughtSignature?: string // content 对应的 part 真签名。仅 Gemini 3 text/reasoning block 会出现；
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

  basedId?: string // 消息是基于哪条用户消息的回答（assistant消息专属，会传给后端 basedId）
  sendType?: SendType // 消息发送的方式（仅前端不落库）
  isCurrentQuestion?: boolean // 是否当前提问问题（user消息专属，仅前端不落库）
  answeringClientId?: string // 这条回答对应哪条用户消息的 clientId（assistant消息专属，仅前端不落库）
  persisting?: boolean // 这条消息是否正在落库（仅前端不落库）
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
