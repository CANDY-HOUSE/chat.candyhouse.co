import type { IConversationConfig, IModelInfo } from '@/types/messagetypes'

/** 必须与后端 CONVERSATION_NAME_MAX_LENGTH（ai-common-layer/config-gen/domains/conversation.ts）保持一致。 */
export const CONV_NAME_MAX_LENGTH = 24

/**
 * 会话显示名解析：convConfig.name → alias（模型注册表）→ modelName。
 */
export const resolveConversationTitle = (modelInfo?: IModelInfo | null): string => {
  if (!modelInfo) return ''
  return modelInfo.convConfig?.name?.trim() || modelInfo.alias?.trim() || modelInfo.modelName
}

/** LLM 可能返回一整段话；折叠空白 + 截断 + 空串归一为 undefined（= 回退默认名） */
export const sanitizeConversationName = (raw?: unknown): string | undefined => {
  if (typeof raw !== 'string') return undefined
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, CONV_NAME_MAX_LENGTH)
  return name || undefined
}

/**
 * convConfig 的唯一合并规则。changeCache 是浅合并，直接传 { convConfig: {...} }
 * 会整块替换——所有写入必须经过这里，否则未来新增字段会互相覆盖。
 */
export const mergeConvConfig = (
  draft: IModelInfo,
  patch: Partial<IConversationConfig>
): Pick<IModelInfo, 'convConfig'> => ({
  convConfig: { ...draft.convConfig, ...patch }
})
