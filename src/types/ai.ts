// AI 模型提供商
export type ModelProvider = 'OpenAI' | 'Anthropic' | 'Google' | 'Deepseek' | 'xAI'

// 统一的响应格式
export interface UnifiedResponse<V = string, C = unknown> {
  model: string
  value: V
  chunk: C
  done: boolean
  thoughtValue?: string
  finishReason?: string
  usage?: {
    inputTokens?: number // 用户输入的 Token 数量（包含系统提示词、对话历史等）
    outputTokens?: number // 模型生成的 Token 数量
    totalTokens?: number // 输入 + 输出的总 Token 数量
    cachedTokens?: number // 缓存的 Token 数量
    reasoningTokens?: number // 推理的 Token 数量
  }
  extra?: Record<string, unknown>
  error?: string
}

// 统一的输入格式
export interface UnifiedInput {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: unknown
  name?: string
  cacheControl?: boolean
}

type CommonStreamValue = { annotations?: any[]; previousResponseId?: string }
type ChatStreamValue = string | Array<{ type: 'text' } & CommonStreamValue>
type ImageStreamValue = { type: 'image'; name?: string; url: string } & CommonStreamValue
type VideoStreamValue = {
  type: 'video'
  name?: string
  url: string
  progress: number
} & CommonStreamValue

export type StreamValue = ChatStreamValue | Array<ImageStreamValue> | Array<VideoStreamValue>
