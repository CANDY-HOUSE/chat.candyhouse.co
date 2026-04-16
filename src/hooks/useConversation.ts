import {
  apiConversationsDelete,
  apiMessagesCreate,
  apiMessagesDelete,
  apiMessagesUpdate
} from '@/api'
import { activeTopicIdAtom, conversationsFamily, store, switchToast, userAtom } from '@/store'
import type { IConversation, IMessage } from '@/types/messagetypes'
import { getLocalValue, localKey, logger } from '@/utils'
import { cacheControlStrategy } from '@/utils/cacheControlStrategy'
import { Level, SendType } from '@constants'
import { useAtomValue } from 'jotai'
import { useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'

export const useConversation = () => {
  const { t } = useTranslation()
  const user = useAtomValue(userAtom)

  // 获取指定话题的会话
  const getConversations = useCallback((topicId?: string) => {
    const id = topicId || store.get(activeTopicIdAtom)
    if (!id) return null

    return store.get(conversationsFamily(id))
  }, [])

  // 设置指定话题的会话
  const setConversations = useCallback((conversations: IConversation[], topicId?: string) => {
    const id = topicId || store.get(activeTopicIdAtom)
    if (!id) return false

    store.set(
      conversationsFamily(id),
      conversations.map((conv) => {
        if (!conv.messages) conv.messages = []
        return conv
      })
    )
  }, [])

  // 更新指定话题的会话
  const updateConversations = useCallback(
    (updater: (prev: IConversation[]) => IConversation[], topicId?: string) => {
      const id = topicId || store.get(activeTopicIdAtom)
      if (!id) return false

      store.set(conversationsFamily(id), (prev) => updater(prev))
    },
    []
  )

  // 获取指定话题的指定会话
  const getConversation = useCallback((conversationId: string, topicId?: string) => {
    const id = topicId || store.get(activeTopicIdAtom)
    if (!id) return null

    return (
      store.get(conversationsFamily(id)).find((conv) => conv.conversationId === conversationId) ||
      null
    )
  }, [])

  // 删除指定话题的指定会话
  const deleteConversation = useCallback(
    async (conversationId: string, topicId?: string) => {
      const id = topicId || store.get(activeTopicIdAtom)
      if (!id) return false

      const convs = getConversations(id)
      if (!convs) return false

      try {
        const index = convs.findIndex((conv) => conv.conversationId === conversationId)
        const conv = convs[index]!
        let success = true

        setConversations(convs.toSpliced(index, 1))

        // 更新到数据库
        if (user?.isLogin) {
          success = await apiConversationsDelete({
            topicId: conv.topicId,
            modelId: conv.modelId
          })
        }

        if (!success) {
          setConversations(convs)
          switchToast({ visible: true, message: t('DelFail'), level: Level.error })
        }
      } catch (error) {
        logger.error('Failed to clear conversation:', error)
        switchToast({ visible: true, message: t('DelFail'), level: Level.error })
      }
    },
    [getConversations, setConversations, t, user?.isLogin]
  )

  // 获取指定话题的指定会话的指定属性
  const getAttrValue = useCallback(
    <T extends keyof Omit<IConversation, 'conversationId'>>(
      conversationId: string,
      attr: T,
      topicId?: string
    ) => {
      const id = topicId || store.get(activeTopicIdAtom)
      if (!id) return null
      const conv = getConversation(conversationId, id)
      if (!conv) return null

      return conv[attr]
    },
    [getConversation]
  )

  // 更新指定话题的指定会话的指定属性值
  const updateAttrsValue = useCallback(
    (
      conversationId: string,
      options: Partial<Omit<IConversation, 'conversationId' | 'topicId'>>,
      topicId?: string
    ) => {
      const id = topicId || store.get(activeTopicIdAtom)
      if (!id) return false

      updateConversations(
        (prev) =>
          prev.map((conv) =>
            conv.conversationId === conversationId ? { ...conv, ...options } : conv
          ),
        id
      )
    },
    [updateConversations]
  )

  // 修改指定话题的指定会话的指定消息
  const updateMessage = useCallback(
    (
      conversationId: string,
      messageId: string,
      options: Partial<Omit<IMessage, 'messageId' | 'clientId' | 'createdAt'>>,
      topicId?: string
    ) => {
      const id = topicId || store.get(activeTopicIdAtom)
      if (!id) return false

      updateConversations(
        (prev) =>
          prev.map((conv) => {
            if (conv.conversationId !== conversationId) return conv

            const newMessages = conv.messages.map((msg) =>
              msg.messageId === messageId ? { ...msg, ...options } : msg
            )

            return { ...conv, messages: newMessages }
          }),
        id
      )
    },
    [updateConversations]
  )

  // 清空指定话题的指定会话消息列表
  const deleteMessage = useCallback(
    async (conversationId: string, messageId?: string, topicId?: string) => {
      const id = (topicId || store.get(activeTopicIdAtom))!

      try {
        const conv = getConversation(conversationId, id)

        if (!conv) {
          logger.warn(`Conversation ${conversationId} not found`)
          return
        }
        if (messageId === '') throw new Error(`The parameter messageId can not be empty`)

        const { messages } = conv
        const deleteAll = messageId === undefined
        let success = true

        // 更新到数据库
        if (user?.isLogin) {
          success = await apiMessagesDelete(conversationId, messageId)
        }

        if (success) {
          if (deleteAll) {
            updateAttrsValue(conversationId, { messages: [] }, id)
          } else {
            const delIdx = messages.findIndex((msg) => msg.messageId === messageId)

            if (delIdx > -1) {
              updateAttrsValue(conversationId, { messages: messages.toSpliced(delIdx, 1) }, id)
            }
          }
        } else {
          switchToast({ visible: true, message: t('DelFail'), level: Level.error })
        }
      } catch (error) {
        logger.error('Failed to clear messages:', error)
        switchToast({ visible: true, message: t('DelFail'), level: Level.error })
      }
    },
    [getConversation, user?.isLogin, t, updateAttrsValue]
  )

  // 修改指定话题的指定会话的 modelInfo
  const updateModelInfo = useCallback(
    (conversationId: string, options: Partial<IConversation['modelInfo']>, topicId?: string) => {
      const id = topicId || store.get(activeTopicIdAtom)
      if (!id) return false

      updateConversations(
        (prev) =>
          prev.map((conv) =>
            conv.conversationId === conversationId
              ? { ...conv, modelInfo: { ...conv.modelInfo, ...options } }
              : conv
          ),
        id
      )
    },
    [updateConversations]
  )

  // 重置指定话题的会话
  const resetConversations = useCallback((topicId?: string) => {
    const id = topicId || store.get(activeTopicIdAtom)
    if (!id) return false

    store.set(conversationsFamily(id), [])
  }, [])

  // 应用缓存控制策略到指定会话
  const applyCacheControlWithAccurateTokens = useCallback(
    (conversationId: string, message: IMessage, topicId?: string) => {
      return new Promise<IMessage | null>((resolve) => {
        const id = (topicId || store.get(activeTopicIdAtom))!
        const conv = getConversation(conversationId, id)
        if (!conv) {
          resolve(null)
          return
        }

        const model = message.model
        const processedMessages: IMessage[] = [...conv.messages, message]

        // 使用新的缓存控制策略
        const newCacheIndex = cacheControlStrategy.decideCachePoint(model, processedMessages)
        const currentCacheIndex = processedMessages.findLastIndex((msg) => msg.cacheControl)

        // 如果缓存点没有变化,直接返回
        if (newCacheIndex === currentCacheIndex) {
          resolve(message)
          return
        }

        // 更新缓存控制标记
        let needUpdate = false
        processedMessages.forEach((msg, index) => {
          const shouldCache = index === newCacheIndex
          const hasCache = !!msg.cacheControl

          if (hasCache !== shouldCache) {
            needUpdate = true
            if (shouldCache) {
              msg.cacheControl = true
            } else {
              delete msg.cacheControl
              // 如果消息已保存,更新数据库
              if (msg.messageId) {
                apiMessagesUpdate(conversationId, msg.messageId, {
                  cacheControl: false
                })
              }
            }
          }
        })

        // 弹出最后一条消息(新消息)
        const lastMsg = processedMessages.pop()!

        // 如果需要更新,同步更新状态
        if (needUpdate) {
          flushSync(() => {
            updateAttrsValue(conversationId, { messages: processedMessages }, id)
          })
        }

        resolve(lastMsg)
      })
    },
    [getConversation, updateAttrsValue]
  )

  // 往指定话题的指定会话消息列表 push 消息
  const pushMessage = useCallback(
    (
      conversationId: string,
      message: IMessage,
      options?: Partial<{ isEnd: boolean; topicId: string }>
    ) => {
      const { isEnd = true, topicId } = options || {}
      return new Promise<void>(async (resolve) => {
        const id = (topicId || store.get(activeTopicIdAtom))!
        const uuid = getLocalValue<string>(localKey.uuid)

        updateConversations((prev) => {
          const updatedConvs = prev.map((conv) => {
            if (conv.conversationId !== conversationId) return conv
            const messages = [...conv.messages]
            const theMsgIndex = messages.findIndex((msg) => msg.clientId === message.clientId)

            if (theMsgIndex === -1) {
              if (message.basedId) {
                // 刷新消息
                const msgIndex = messages.findIndex((msg) => msg.messageId === message.basedId)

                if (msgIndex > -1) {
                  messages.splice(msgIndex + 1, 0, message)
                }
              } else {
                // 新消息
                messages.push({
                  ...message
                })
              }
            } else {
              // 既有消息
              messages[theMsgIndex] = { ...messages[theMsgIndex], ...message }
            }

            return {
              ...conv,
              messages,
              ...(isEnd && { modelInfo: { ...conv.modelInfo, atWork: false } })
            }
          })

          return updatedConvs
        }, id)

        // 处理异步操作
        if (isEnd) {
          try {
            let result: {
              createdAt: string
              messageId: string
            } | null

            const { sendType, basedId, isCurrentQuestion, createdAt, ..._message } = message

            // http request
            if (user?.isLogin) {
              const msgCreateParam = { ..._message, topicId: id, uuid }
              const msgUpdateParam = {
                content: _message.content,
                state: _message.state,
                tokens: _message.tokens,
                totalTokens: _message.totalTokens,
                words: _message.words,
                annotations: _message.annotations,
                thoughtValue: _message.thoughtValue,
                ...(_message.previousResponseId && {
                  previousResponseId: _message.previousResponseId
                })
              }

              if (sendType === SendType.refresh) {
                if (basedId) {
                  result = await apiMessagesCreate({
                    conversationId,
                    body: msgCreateParam,
                    afterMessageId: basedId
                  })
                } else {
                  await apiMessagesUpdate(conversationId, message.messageId!, msgUpdateParam)
                }
              } else {
                if (message.role === 'user') {
                  // User message content is passed as-is
                  delete msgCreateParam.tokens
                  delete msgCreateParam.totalTokens
                }

                result = await apiMessagesCreate({
                  conversationId,
                  body: msgCreateParam
                })
              }
            }

            // 更新 messages
            updateConversations(
              (prev) =>
                prev.map((conv) => {
                  if (conv.conversationId === conversationId) {
                    const messages = [...conv.messages]
                    const theMsgIndex = messages.findIndex(
                      (msg) => msg.clientId === message.clientId
                    )
                    const theMsg = messages[theMsgIndex]

                    if (theMsg) {
                      delete theMsg.sendType
                      delete theMsg.basedId

                      if (result) {
                        theMsg.messageId = result.messageId
                        theMsg.createdAt = result.createdAt
                      } else {
                        theMsg.messageId = theMsg.clientId
                        theMsg.createdAt = new Date().toISOString()
                      }

                      messages.forEach((msg) => {
                        if (message.role === 'assistant') {
                          delete msg.isCurrentQuestion
                        }
                      })

                      return { ...conv, messages }
                    }
                  }

                  return conv
                }),
              id
            )
          } catch (error) {
            logger.error('Async operations failed:', error)
          }
        }

        resolve()
      })
    },
    [user?.isLogin, updateConversations]
  )

  return {
    getConversations,
    getConversation,
    getAttrValue,

    setConversations,
    updateAttrsValue,
    updateModelInfo,
    updateMessage,
    deleteMessage,
    deleteConversation,

    pushMessage,
    resetConversations,
    applyCacheControlWithAccurateTokens
  }
}
