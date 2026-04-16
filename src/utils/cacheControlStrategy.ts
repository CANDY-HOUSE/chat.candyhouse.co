import type { IMessage } from '@/types/messagetypes'

/**
 * 使用启发式规则决定何时插入 cacheControl,无需精确计算 tokens
 *
 * 核心策略:
 * 1. 只对 Claude 模型启用缓存
 * 2. 基于消息数量和平均长度估算是否达到缓存阈值
 * 3. 将缓存点放在最后一条 user 消息上
 * 4. 避免频繁移动缓存点(使用增量策略)
 */

interface CacheControlConfig {
  /** 启用缓存的最小消息数 */
  minMessages: number
  /** 每条消息的平均字符数估算(用于快速判断) */
  avgCharsPerMessage: number
  /** Claude 的 token/字符比率估算 (约 1 token = 4 chars) */
  charsPerToken: number
  /** 启用缓存的最小 token 数 */
  minCacheTokens: number
  /** 重新设置缓存点的最小间隔消息数 */
  minMessagesToResetCache: number
}

const DEFAULT_CONFIG: CacheControlConfig = {
  minMessages: 4,
  avgCharsPerMessage: 500,
  charsPerToken: 4,
  minCacheTokens: 2048,
  minMessagesToResetCache: 3
}

export class CacheControlStrategy {
  private config: CacheControlConfig

  constructor(config?: Partial<CacheControlConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 判断是否应该为 Claude 模型启用缓存
   */
  private isClaudeModel(model: string): boolean {
    return model.toLowerCase().includes('claude')
  }

  /**
   * 快速估算消息列表的总 token 数
   */
  private estimateTotalTokens(messages: IMessage[]): number {
    let totalChars = 0

    for (const msg of messages) {
      if (msg.content) {
        for (const block of msg.content) {
          if (block.type === 'text' && block.content) {
            totalChars += block.content.length
          } else if (block.type === 'image' || block.type === 'file') {
            // 图片和文件估算为固定 token 数
            totalChars += 1000 * this.config.charsPerToken
          }
        }
      }
    }

    return Math.ceil(totalChars / this.config.charsPerToken)
  }

  /**
   * 找到最后一条 user 消息的索引
   */
  private findLastUserMessageIndex(messages: IMessage[]): number {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === 'user') {
        return i
      }
    }
    return -1
  }

  /**
   * 找到当前缓存点的索引
   */
  private findCurrentCacheIndex(messages: IMessage[]): number {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.cacheControl) {
        return i
      }
    }
    return -1
  }

  /**
   * 决定是否需要设置或移动缓存点
   *
   * @param model - 模型名称
   * @param messages - 包含新消息的完整消息列表
   * @returns 缓存点的索引,如果不需要缓存则返回 -1
   */
  decideCachePoint(model: string, messages: IMessage[]): number {
    if (!this.isClaudeModel(model)) {
      return -1
    }

    if (messages.length < this.config.minMessages) {
      return -1
    }

    const estimatedTokens = this.estimateTotalTokens(messages)
    if (estimatedTokens < this.config.minCacheTokens) {
      return -1
    }

    const lastUserIndex = this.findLastUserMessageIndex(messages)
    if (lastUserIndex < 0) {
      return -1
    }

    const currentCacheIndex = this.findCurrentCacheIndex(messages)

    if (currentCacheIndex < 0) {
      return lastUserIndex
    }

    if (currentCacheIndex === lastUserIndex) {
      return currentCacheIndex
    }

    const uncachedMessageCount = lastUserIndex - currentCacheIndex

    if (uncachedMessageCount >= this.config.minMessagesToResetCache) {
      const uncachedMessages = messages.slice(currentCacheIndex + 1, lastUserIndex + 1)
      const uncachedTokens = this.estimateTotalTokens(uncachedMessages)

      // 只有未缓存部分也达到最小阈值时才移动
      if (uncachedTokens >= this.config.minCacheTokens) {
        return lastUserIndex
      }
    }

    return currentCacheIndex
  }

  /**
   * 应用缓存控制策略到消息列表
   *
   * @param model - 模型名称
   * @param messages - 消息列表(会被就地修改)
   * @returns 修改后的消息列表
   */
  applyCacheControl(model: string, messages: IMessage[]): IMessage[] {
    const cacheIndex = this.decideCachePoint(model, messages)

    // 清除所有旧的缓存点
    messages.forEach((msg) => {
      delete msg.cacheControl
    })

    // 设置新的缓存点
    if (cacheIndex >= 0) {
      const msg = messages[cacheIndex]
      if (msg) {
        msg.cacheControl = true
      }
    }

    return messages
  }
}

export const cacheControlStrategy = new CacheControlStrategy()
