import { apiPostConfigGen } from '@/api'
import type {
  ConfigDomain,
  ConfigDomainMap,
  ConfigGenExplanation,
  IModelInfo
} from '@/types/messagetypes'
import { logger, mergeConvConfig, sanitizeConversationName } from '@/utils'

/** 弹窗注入的上下文。getDraft 是函数而非快照：apply 在 await 之后调用，闭包快照会过期。 */
export interface ConfigDomainContext {
  conversationId: string
  modelName: string
  getDraft: () => IModelInfo
  /** 唯一写入口：同时更新弹窗渲染态 + Settings 的落库缓存 */
  patchDraft: (patch: Partial<IModelInfo>) => void
}

export interface ConfigDomainStrategy<D extends ConfigDomain> {
  domain: D
  gtagAction: string // 埋点 action_type
  /** 把生成结果路由到正确的 modelInfo 命名空间 */
  apply: (config: ConfigDomainMap[D], ctx: ConfigDomainContext) => void
  /** 合并手风琴预览取数；标题现在只有一个（会话配置），不再需要 per-domain titleKey */
  preview: { select: (draft: IModelInfo) => unknown }
}

const modelDomain: ConfigDomainStrategy<'model'> = {
  domain: 'model',
  gtagAction: 'config_gen_model',
  apply: (config, { patchDraft }) => patchDraft({ jsonConfig: config }),
  preview: { select: (d) => d.jsonConfig ?? {} }
}

const conversationDomain: ConfigDomainStrategy<'conversation'> = {
  domain: 'conversation',
  gtagAction: 'config_gen_conversation',
  apply: (config, { getDraft, patchDraft }) =>
    patchDraft(
      mergeConvConfig(getDraft(), {
        ...config,
        name: sanitizeConversationName(config.name)
      })
    ),
  preview: { select: (d) => d.convConfig ?? {} }
}

export const CONFIG_DOMAINS = { model: modelDomain, conversation: conversationDomain } satisfies {
  [D in ConfigDomain]: ConfigDomainStrategy<D>
}

/** 合并预览 / 按域遍历的渲染顺序 */
export const CONFIG_DOMAIN_ORDER: ConfigDomain[] = ['model', 'conversation']

/** 类型擦除后的运行时查表：唯一一处 cast，其余代码用 domain: string 安全查表。 */
const DOMAIN_STRATEGIES = CONFIG_DOMAINS as Record<string, ConfigDomainStrategy<ConfigDomain>>

export interface ConfigGenRunResult {
  explanations: ConfigGenExplanation[]
  /** 命中的 domain，供调用方按域打点 / 展示 */
  domains: ConfigDomain[]
}

/**
 * 统一调度：请求（domain 由后端分类器决定，可能命中多个）→ 按域路由结果。
 * 后端 registry 可能领先前端注册表（新 domain 先上后端，UI 后补）——遇到未知 domain
 * 只 warn 并跳过，不崩、不阻塞其它已识别 domain 的应用。
 */
export const runConfigGen = async (
  description: string,
  ctx: ConfigDomainContext
): Promise<ConfigGenRunResult> => {
  const { results } = await apiPostConfigGen({ model: ctx.modelName, description })

  const explanations: ConfigGenExplanation[] = []
  const domains: ConfigDomain[] = []

  for (const result of results) {
    const strategy = DOMAIN_STRATEGIES[result.domain]
    if (!strategy) {
      logger.warn(`[configDomains] unknown domain from backend: ${result.domain}`)
      continue
    }
    strategy.apply(result.config, ctx)
    explanations.push(...result.explanations)
    domains.push(strategy.domain)
  }

  return { explanations, domains }
}
