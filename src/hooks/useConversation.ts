import {
  apiConversationsDelete,
  apiMessagesCreate,
  apiMessagesDelete,
  apiMessagesUpdate
} from '@/api'
import { activeTopicIdAtom, conversationsFamily, store, userAtom } from '@/store'
import type { IConversation, IMessage } from '@/types/messagetypes'
import { getLocalValue, localKey, logger } from '@/utils'
import { cacheControlStrategy } from '@/utils/cacheControlStrategy'
import { MessageState, SendType } from '@constants'
import { useAtomValue } from 'jotai'
import { useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useOptimistic } from './useOptimistic'

// 会话内是否仍有消息处于生成中或落库中
export const isConversationBusy = (messages: IMessage[]): boolean =>
  messages.some(
    (msg) =>
      msg.state === MessageState.loading || msg.state === MessageState.start || msg.persisting
  )

export const useConversation = () => {
  const { t } = useTranslation()
  const user = useAtomValue(userAtom)
  const { runOptimistic } = useOptimistic()

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

      const index = convs.findIndex((conv) => conv.conversationId === conversationId)
      if (index === -1) {
        logger.warn(`Conversation ${conversationId} not found`)
        return false
      }
      const conv = convs[index]!

      await runOptimistic({
        apply: () => setConversations(convs.toSpliced(index, 1), id),
        commit: () => apiConversationsDelete({ topicId: conv.topicId, modelId: conv.modelId }),
        // 把被删的那条插回「当前」列表，而不是整体还原快照——否则同话题下其他会话这期间的流式更新会被一起回退掉
        rollback: () => {
          const latest = store.get(conversationsFamily(id))
          if (latest.some((item) => item.conversationId === conversationId)) return
          setConversations(latest.toSpliced(index, 0, conv), id)
        },
        failMessage: t('DelFail')
      })
    },
    [getConversations, setConversations, t, runOptimistic]
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

  // 按 clientId 修改指定话题的指定会话的指定消息
  const updateMessageByClientId = useCallback(
    (
      conversationId: string,
      clientId: string,
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
              msg.clientId === clientId ? { ...msg, ...options } : msg
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
      const conv = getConversation(conversationId, id)

      if (!conv) {
        logger.warn(`Conversation ${conversationId} not found`)
        return
      }
      if (messageId === '') {
        logger.error('Failed to clear messages: the parameter messageId can not be empty')
        return
      }

      const { messages } = conv
      const deleteAll = messageId === undefined
      const delIdx = deleteAll ? -1 : messages.findIndex((msg) => msg.messageId === messageId)
      if (!deleteAll && delIdx === -1) return

      const nextMessages = deleteAll ? [] : messages.toSpliced(delIdx, 1)

      await runOptimistic({
        apply: () => updateAttrsValue(conversationId, { messages: nextMessages }, id),
        commit: () => apiMessagesDelete(conversationId, messageId),
        // 单条删除时把消息插回「当前」列表，避免回退掉这期间本会话的流式更新；清空全部则只能整体还原
        rollback: () => {
          if (deleteAll) {
            updateAttrsValue(conversationId, { messages }, id)
            return
          }

          const latest = getConversation(conversationId, id)?.messages ?? []
          updateAttrsValue(
            conversationId,
            { messages: latest.toSpliced(delIdx, 0, messages[delIdx]!) },
            id
          )
        },
        failMessage: t('DelFail')
      })
    },
    [getConversation, t, updateAttrsValue, runOptimistic]
  )

  // 修改指定话题的指定会话的 modelInfo
  const updateModelInfo = useCallback(
    (conversationId: string, options: Partial<IConversation['modelInfo']>, topicId?: string) => {
      const id = topicId || store.get(activeTopicIdAtom)
      if (!id) return false

      updateConversations((prev) => {
        const index = prev.findIndex((conv) => conv.conversationId === conversationId)
        if (index === -1) return prev

        const conv = prev[index]!
        // 同值不写：挂载期 disable 这类字段会被反复赋成同一个值，
        // 每次都新建 modelInfo 对象会让整条会话白白重渲染一轮
        const changed = (Object.keys(options) as Array<keyof typeof options>).some(
          (key) => conv.modelInfo[key] !== options[key]
        )
        if (!changed) return prev

        return prev.with(index, { ...conv, modelInfo: { ...conv.modelInfo, ...options } })
      }, id)
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

            if (isEnd) {
              const pushedMsg = messages.find((msg) => msg.clientId === message.clientId)
              if (pushedMsg) pushedMsg.persisting = true
            }

            return { ...conv, messages }
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

            const {
              sendType,
              basedId,
              isCurrentQuestion,
              answeringClientId,
              persisting,
              createdAt,
              ..._message
            } = message

            // http request
            if (user?.isLogin) {
              const msgCreateParam = { ..._message, topicId: id, uuid }
              const msgUpdateParam = {
                content: _message.content,
                state: _message.state,
                tokens: _message.tokens,
                totalTokens: _message.totalTokens,
                words: _message.words,
                annotations: _message.annotations ?? [],
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
                    basedId
                  })
                } else {
                  await apiMessagesUpdate(conversationId, message.messageId!, msgUpdateParam)
                }
              } else {
                if (message.role === 'user') {
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
                      delete theMsg.persisting
                      // answeringClientId 保留：refresh 这条消息时要靠它精确定位对应的 user 消息

                      if (result) {
                        theMsg.messageId = result.messageId
                        theMsg.createdAt = result.createdAt
                      } else {
                        theMsg.createdAt = new Date().toISOString()
                      }

                      // 只清掉这条回答对应的那条用户消息
                      if (message.role === 'assistant' && answeringClientId) {
                        const answeredMsg = messages.find(
                          (msg) => msg.clientId === answeringClientId
                        )
                        if (answeredMsg) delete answeredMsg.isCurrentQuestion
                      }

                      // 只有这条消息真正落库完成后才允许清空 atWork——否则消息队列会在
                      // 回答刚流完、还没写库时就把下一条提前发出去，导致后端按 createdAt
                      // 排序时顺序错乱
                      return {
                        ...conv,
                        messages,
                        ...(!isConversationBusy(messages) && {
                          modelInfo: { ...conv.modelInfo, atWork: false }
                        })
                      }
                    }
                  }

                  return conv
                }),
              id
            )
          } catch (error) {
            logger.error('Async operations failed:', error)

            // 落库失败也要清掉 persisting 并放行队列，否则这个会话会永久卡在"忙碌"状态
            updateConversations(
              (prev) =>
                prev.map((conv) => {
                  if (conv.conversationId !== conversationId) return conv

                  const messages = [...conv.messages]
                  const theMsg = messages.find((msg) => msg.clientId === message.clientId)
                  if (theMsg) delete theMsg.persisting

                  return {
                    ...conv,
                    messages,
                    ...(!isConversationBusy(messages) && {
                      modelInfo: { ...conv.modelInfo, atWork: false }
                    })
                  }
                }),
              id
            )
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
    updateMessageByClientId,
    deleteMessage,
    deleteConversation,

    pushMessage,
    resetConversations,
    applyCacheControlWithAccurateTokens
  }
}
