import { useConversation } from '@/hooks/useConversation'
import { focusMessageAtom } from '@/store'
import { type IConversation, type IMessage } from '@/types/messagetypes'
import { apiMessagesGet } from '@api'
import { ScrollState, SendType } from '@constants'
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown'
import ArrowCircleUpIcon from '@mui/icons-material/ArrowCircleUp'
import SouthIcon from '@mui/icons-material/South'
import { Box, Button, IconButton } from '@mui/material'
import { useAtom } from 'jotai'
import { throttle } from 'lodash-es'
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SwiperRef } from 'swiper/react'
import MessageHeader from './MessageHeader'
import MessageItem from './MessageItem'

interface Props {
  conversation: IConversation
  panelRef: React.RefObject<HTMLDivElement | null>
  swiperRef?: React.RefObject<SwiperRef | null>
}

const customStyle = {
  container: {
    position: 'relative',
    height: '100%',
    width: '100%',
    overflow: 'hidden'
  },
  mainBox: {
    height: '100%',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    boxSizing: 'border-box',
    overflowAnchor: 'none'
  },
  fastScrollBox: {
    position: 'absolute',
    right: '.1rem',
    bottom: '1rem',
    zIndex: 1000
  }
}

const MessageList: React.FC<Props> = ({ conversation, panelRef, swiperRef }) => {
  const { t } = useTranslation()
  const [focusMessage, setFocusMessage] = useAtom(focusMessageAtom)
  const [scrollState, setScrollState] = useState(ScrollState.null)
  const { updateAttrsValue } = useConversation()

  const conversationRef = useRef(conversation)
  const isLoadingRef = useRef(false)
  const scrollStopTimer = useRef<NodeJS.Timeout | null>(null)
  const scrollStateRef = useRef<ScrollState>(ScrollState.null)
  const isManualScrolling = useRef(false)
  const scrollRafIdRef = useRef<number>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)

  conversationRef.current = conversation
  scrollStateRef.current = scrollState

  const didRefresh = useMemo(
    () => conversation.messages.some((msg) => msg.sendType === SendType.refresh),
    [conversation.messages]
  )

  const afterLoadMoreUpdateSwiper = useCallback(() => {
    if (swiperRef?.current?.swiper) {
      const swiper = swiperRef.current.swiper
      swiper.update()
      swiper.updateSlides()
      swiper.pagination.update()
    }
  }, [swiperRef])

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'auto') => {
    const el = containerRef.current
    if (!el) return

    if (behavior === 'smooth') {
      el.scrollTo({
        top: containerRef.current!.scrollHeight,
        behavior: 'smooth'
      })
    } else {
      el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight)
    }
  }

  const scrollToMessage = (messageId: string, block: ScrollLogicalPosition = 'start') => {
    if (!messageId || !containerRef.current) return false
    const el = containerRef.current.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)
    if (!el) return false

    // 如果是滚动到顶部，需要考虑 header 高度
    if (block === 'start') {
      const container = containerRef.current
      const elRect = el.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      // 计算 header 高度
      const headerHeight = parseFloat(getComputedStyle(document.documentElement).fontSize) * 2.6

      // 计算目标滚动位置：元素相对于容器的位置 + 当前滚动位置 - header 高度
      const targetScrollTop = elRect.top - containerRect.top + container.scrollTop - headerHeight

      container.scrollTo({
        top: targetScrollTop,
        behavior: 'auto'
      })
    } else {
      el.scrollIntoView({ behavior: 'auto', block, inline: 'nearest' })
    }

    return true
  }

  const loadMore = useCallback(
    async (conversationId: string, nextToken?: string, isRefresh?: boolean) => {
      try {
        const param: {
          id: string
          preAnchorTimestamp?: string
          nextToken?: string
        } = { id: conversationId }

        if (focusMessage === null) {
          param.nextToken = nextToken
        } else {
          param.preAnchorTimestamp = nextToken
        }

        if (isRefresh) {
          delete param.preAnchorTimestamp
          setFocusMessage(null)
        }

        const res = await apiMessagesGet(param)

        const current = conversationRef.current

        if (res) {
          const { messages, nextToken: newToken } = res
          const finalMessages = [...messages]
          if (!isRefresh) finalMessages.push(...current.messages)

          updateAttrsValue(conversationId, {
            nextToken: newToken,
            messages: finalMessages
          })

          await new Promise<void>((r) => requestAnimationFrame(() => r()))
          await new Promise<void>((r) => requestAnimationFrame(() => r()))

          const anchorId = isRefresh
            ? messages[messages.length - 1]?.messageId
            : current.messages[0]?.messageId
          if (anchorId) {
            scrollToMessage(anchorId)
          }
        }
      } finally {
        isLoadingRef.current = false
      }
    },
    [focusMessage, setFocusMessage, updateAttrsValue]
  )

  const handleScroll = useMemo(
    () =>
      throttle(
        (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
          e.stopPropagation()

          if (scrollRafIdRef.current) {
            cancelAnimationFrame(scrollRafIdRef.current)
          }

          scrollRafIdRef.current = requestAnimationFrame(() => {
            if (!containerRef.current) return

            const scrollMetrics = {
              scrollTop: containerRef.current.scrollTop,
              scrollHeight: containerRef.current.scrollHeight,
              clientHeight: containerRef.current.clientHeight
            }
            const { scrollTop, scrollHeight, clientHeight } = scrollMetrics
            let scrollState: ScrollState

            if (scrollHeight === clientHeight) {
              scrollState = ScrollState.null
            } else if (scrollTop === 0) {
              scrollState = ScrollState.top
            } else if (Math.abs(scrollTop + clientHeight - scrollHeight) <= 5) {
              scrollState = ScrollState.bottom
            } else {
              scrollState = ScrollState.middle
            }

            setScrollState(scrollState)

            if (scrollState === ScrollState.top && !isLoadingRef.current) {
              const { conversationId, nextToken } = conversationRef.current

              if (nextToken) {
                isLoadingRef.current = true
                loadMore(conversationId, nextToken).then(afterLoadMoreUpdateSwiper)
              }
            }

            if (scrollStopTimer.current) {
              clearTimeout(scrollStopTimer.current)
            }

            scrollStopTimer.current = setTimeout(() => {
              if (!conversation.modelInfo.atWork) isManualScrolling.current = false
            }, 2000)
          })
        },
        100,
        { leading: true, trailing: true }
      ),
    [afterLoadMoreUpdateSwiper, conversation.modelInfo.atWork, loadMore]
  )

  // 初始填充内容至满屏
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const tryFill = () => {
      if (isLoadingRef.current) return
      const { conversationId, nextToken } = conversationRef.current
      const needMore = container.scrollHeight <= container.clientHeight + 1
      if (needMore && nextToken) {
        isLoadingRef.current = true
        loadMore(conversationId, nextToken).then(() => {
          afterLoadMoreUpdateSwiper()
          requestAnimationFrame(tryFill)
        })
      }
    }

    const id = requestAnimationFrame(tryFill)
    return () => cancelAnimationFrame(id)
  }, [conversation.conversationId, loadMore, afterLoadMoreUpdateSwiper])

  // 仅当用户当前不在底部时，才认为是“手动滚动”
  const handleUserInteraction = useCallback(() => {
    if (scrollStateRef.current === ScrollState.middle) {
      isManualScrolling.current = true
    }
  }, [])

  // 监听跳转消息
  useEffect(() => {
    if (!focusMessage || focusMessage.conversationId !== conversation.conversationId) return
    const hasTarget = conversation.messages.some((msg) => msg.messageId === focusMessage.messageId)
    if (!hasTarget) return

    setTimeout(() => {
      scrollToMessage(focusMessage.messageId, 'center')
    }, 1200)
  }, [conversation.conversationId, conversation.messages, focusMessage])

  // 监听用户交互事件
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('wheel', handleUserInteraction, { passive: true })
    container.addEventListener('touchmove', handleUserInteraction, { passive: true })
    container.addEventListener('touchend', handleUserInteraction, { passive: true })

    return () => {
      container.removeEventListener('wheel', handleUserInteraction)
      container.removeEventListener('touchmove', handleUserInteraction)
      container.removeEventListener('touchend', handleUserInteraction)
    }
  }, [handleUserInteraction])

  // 模型回答时 自动滚动到底部
  useLayoutEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content || !conversation.modelInfo.atWork || didRefresh) return

    let rafId: number | null = null
    let lastScrollHeight = container.scrollHeight

    const scrollIfNeeded = () => {
      if (isManualScrolling.current) return
      const h = container.scrollHeight
      if (h !== lastScrollHeight) {
        lastScrollHeight = h
        if (rafId) cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(() => {
          container.scrollTop = h - container.clientHeight
          rafId = null
        })
      }
    }

    // DOM 变更
    const mutationObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes?.forEach((node) => {
          if (node instanceof HTMLImageElement) {
            node.addEventListener('load', scrollIfNeeded, { once: true })
          } else if (node instanceof Element) {
            node.querySelectorAll('img').forEach((img) => {
              img.addEventListener('load', scrollIfNeeded, { once: true })
            })
          }
        })
      }
      scrollIfNeeded()
    })
    mutationObserver.observe(content, {
      childList: true,
      subtree: true,
      characterData: true
    })

    // 尺寸变化
    const resizeObserver = new ResizeObserver(() => {
      scrollIfNeeded()
    })
    resizeObserver.observe(content)

    // 初始先滚到底一次
    container.scrollTop = container.scrollHeight - container.clientHeight

    return () => {
      setTimeout(() => {
        if (rafId) cancelAnimationFrame(rafId)
        resizeObserver.disconnect()
        mutationObserver.disconnect()
        isManualScrolling.current = false
      }, 1200)
    }
  }, [conversation.modelInfo.atWork, didRefresh])

  // 加载时，滚动到底部
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let rafId: number | null = null
    let disconnectTimer: NodeJS.Timeout | null = null

    const mutationObserver = new MutationObserver(() => {
      if (disconnectTimer) clearTimeout(disconnectTimer)
      if (rafId) cancelAnimationFrame(rafId)

      rafId = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight - container.clientHeight
          rafId = null
          disconnectTimer = setTimeout(() => mutationObserver.disconnect(), 1000)
        })
      })
    })
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true
    })

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight - container.clientHeight
      })
    })
    resizeObserver.observe(container)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (disconnectTimer) clearTimeout(disconnectTimer)

      resizeObserver.disconnect()
      mutationObserver.disconnect()
      scrollStopTimer.current && clearTimeout(scrollStopTimer.current)
      scrollRafIdRef.current && cancelAnimationFrame(scrollRafIdRef.current)
    }
  }, [])

  return (
    <>
      <MessageHeader panelRef={panelRef} conversation={conversation} />

      <Box sx={customStyle.container}>
        <Box
          className="global-scrollbar"
          ref={containerRef}
          sx={customStyle.mainBox}
          onScroll={handleScroll}
        >
          <div ref={contentRef}>
            {conversation.messages?.map((message: IMessage, index: number) => (
              <div
                key={message.clientId}
                data-message-id={message.messageId}
                style={{
                  marginTop: index === 0 ? '2.6rem' : 0
                }}
              >
                <MessageItem conversationId={conversation.conversationId} message={message} />
              </div>
            ))}
          </div>

          {/* 跳转到最新消息 */}
          {focusMessage && focusMessage.conversationId === conversation.conversationId && (
            <Button
              fullWidth
              size="large"
              sx={{ my: 'var(--spacing-md)' }}
              endIcon={<SouthIcon />}
              onClick={() => loadMore(focusMessage.conversationId, undefined, true)}
            >
              {t('jumpToLatestMsg')}
            </Button>
          )}
        </Box>
      </Box>

      {/* 一键滚动 */}
      {scrollState !== ScrollState.null && (
        <Box sx={customStyle.fastScrollBox}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {scrollState !== ScrollState.top && (
              <IconButton onClick={scrollToTop}>
                <ArrowCircleUpIcon
                  sx={{
                    fontSize: 'var(--icon-size)'
                  }}
                />
              </IconButton>
            )}
            {scrollState !== ScrollState.bottom && (
              <IconButton onClick={() => scrollToBottom('smooth')}>
                <ArrowCircleDownIcon
                  sx={{
                    fontSize: 'var(--icon-size)'
                  }}
                />
              </IconButton>
            )}
          </Box>
        </Box>
      )}
    </>
  )
}

export default React.memo(MessageList)
