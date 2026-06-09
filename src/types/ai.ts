// AI 模型提供商
export type ModelProvider = 'OpenAI' | 'Anthropic' | 'Google' | 'Deepseek' | 'xAI'

// 统一的响应格式
export interface UnifiedResponse<V = string> {
  model: string
  value: V
  done: boolean
  thoughtValue?: string
  finishReason?: string
  responseId?: string
  usage?: {
    inputTokens?: number // 用户输入的 Token 数量（包含系统提示词、对话历史等）
    outputTokens?: number // 模型生成的 Token 数量
    totalTokens?: number // 输入 + 输出的总 Token 数量
    cachedTokens?: number // 缓存的 Token 数量
    reasoningTokens?: number // 推理的 Token 数量
  }
  sources?: {
    url: string
    title?: string
    providerMetadata?: Record<string, unknown>
  }[]
  thoughtSignature?: string // chunk 对应的 part 真签名。仅 Gemini 3 text/reasoning block 会出现；
  error?: string
}

// 统一的输入格式
export interface UnifiedInput {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: ChatCompletionContentPart[]
  name?: string
  cacheControl?: boolean
  metadata?: Record<string, unknown>
}

export type ChatCompletionContentPart =
  | { type: 'text'; text: string; thoughtSignature?: string }
  | {
      type: 'image_url'
      image_url: { url: string }
      thoughtSignature?: string
    }
  | {
      type: 'file'
      file: { file_data?: string; filename?: string; file_id?: string }
      thoughtSignature?: string
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
