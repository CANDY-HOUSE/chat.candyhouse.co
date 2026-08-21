import Loading from '@/components/Loading'
import { useMediaQueryContext } from '@/context/MediaQueryContext'
import { useMessageListContext } from '@/context/MessageListContext'
import { ResizableDivider } from '@/features/common/ResizableDivider'
import { ResizableDividerMain } from '@/features/common/ResizableDividerMain'
import EditorPanel from '@/features/editor/EditorPanel'
import RealtimePanel from '@/features/media/RealtimePanel'
import { useConversation } from '@/hooks/useConversation'
import {
  UI_CONSTANTS,
  activeTopicIdAtom,
  bootstrappedAtom,
  checkedConversationsAtom,
  isShowSideBarAtom,
  loadingAtom,
  sideBarWidthAtom,
  viewTypeAtom
} from '@/store'
import type { IConversation } from '@/types/messagetypes'
import { ViewModel } from '@constants'
import { Box } from '@mui/material'
import type { PrimitiveAtom } from 'jotai'
import { useAtom, useAtomValue } from 'jotai'
import { debounce } from 'lodash-es'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Pagination } from 'swiper/modules'
import { Swiper, SwiperSlide, type SwiperRef } from 'swiper/react'
import { Swiper as SwiperType } from 'swiper/types'
import MessageList from './MessageList'
import MessageListSkeleton from './MessageListSkeleton'

import 'swiper/css'
import 'swiper/css/pagination'

const customStyle = {
  container: {
    position: 'relative',
    flex: 'auto',
    overflow: 'hidden'
  },
  mainBox: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    overflow: 'hidden'
  }
}

const MainContent = () => {
  const { isMobile } = useMediaQueryContext()
  const { widths, setWidths, expandedIndex } = useMessageListContext()
  const { updateModelInfo } = useConversation()
  const activeTopicId = useAtomValue(activeTopicIdAtom)
  const loading = useAtomValue(loadingAtom)
  const sideBarWidth = useAtomValue<number>(sideBarWidthAtom)
  const [isShowSideBar, setIsShowSideBar] = useAtom(isShowSideBarAtom)
  const viewType = useAtomValue(viewTypeAtom)
  const conversations = useAtomValue(checkedConversationsAtom)
  const bootstrapped = useAtomValue(bootstrappedAtom)
  const [activeIndex, setActiveIndex] = useState(0)
  const [allowSlideNext, setAllowSlideNext] = useState(true)
  const [swiperSlideW, setSwiperSlideW] = useState(window.innerWidth)
  // 首帧不播布局/入场动画，避免刷新时宽度落位被动画成"滑行"
  const [layoutReady, setLayoutReady] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const swiperRef = useRef<SwiperRef>(null)
  const conversationsRef = useRef(conversations)
  conversationsRef.current = conversations

  const ConversationItem = useMemo(
    () =>
      React.memo(
        ({
          convAtom,
          swiperRef
        }: {
          convAtom: PrimitiveAtom<IConversation>
          swiperRef?: React.RefObject<SwiperRef | null>
        }) => {
          const conversation = useAtomValue(convAtom)
          return (
            <MessageList
              panelRef={containerRef}
              swiperRef={swiperRef}
              conversation={conversation}
            />
          )
        }
      ),
    []
  )

  // widths 尚未下发时的同步兜底宽度：面板宽度绝不由内容撑开
  const fallbackWidth = useMemo(() => {
    const cLength = conversations.length
    if (cLength === 0) return UI_CONSTANTS.chatMinWidth

    const totalWidth = containerRef.current?.offsetWidth ?? window.innerWidth
    return Math.max(
      UI_CONSTANTS.chatMinWidth,
      Math.trunc((totalWidth - UI_CONSTANTS.resizeLineWidth * cLength) / cLength)
    )
  }, [conversations.length])

  // 骨架屏列宽：会话已到就照最终版面画，没到就按可视宽度粗估列数
  const skeletonWidths = useMemo(() => {
    if (isMobile) return [swiperSlideW]

    if (conversations.length > 0) {
      return conversations.map(({ id }) => widths.find((w) => w.id === id)?.width ?? fallbackWidth)
    }

    const available = window.innerWidth - (isShowSideBar ? sideBarWidth : 0)
    const count = Math.max(1, Math.min(4, Math.floor(available / UI_CONSTANTS.chatMinWidth)))

    return Array.from({ length: count }, () => Math.trunc(available / count))
  }, [conversations, widths, fallbackWidth, isMobile, swiperSlideW, isShowSideBar, sideBarWidth])

  // 均分各消息列表宽度
  const averageListWidth = useCallback(() => {
    const cLength = conversationsRef.current.length
    if (containerRef.current && cLength > 0) {
      const newTotalWidth = containerRef.current.offsetWidth
      const equalWidth = Math.trunc(
        (newTotalWidth - UI_CONSTANTS.resizeLineWidth * cLength) / cLength
      )

      setWidths(
        conversationsRef.current.map((conv) => {
          const width =
            equalWidth < UI_CONSTANTS.chatMinWidth ? UI_CONSTANTS.chatMinWidth : equalWidth

          return {
            id: conv.id,
            width,
            orignalWidth: width
          }
        })
      )
    }
  }, [setWidths])

  // 拖动改变消息列表宽度
  const resizeListWidth = useCallback(
    (index: number, newWidth: number) => {
      const ws = [...widths]
      if (newWidth < UI_CONSTANTS.chatMinWidth) return

      if (index >= 0 && index < ws.length && ws[index]) {
        ws[index].orignalWidth = ws[index].width = Math.trunc(newWidth)
        setWidths(ws)
      }
    },
    [setWidths, widths]
  )

  // 监听 activeIndex变化
  useEffect(() => {
    if (!isMobile) return

    conversationsRef.current.forEach((conv, index) => {
      updateModelInfo(conv.id, { disable: index !== activeIndex })
    })
  }, [activeIndex, isMobile, updateModelInfo, conversations.length])

  // 监听是否展开会话列表
  useEffect(() => {
    if (isMobile) return

    conversationsRef.current.forEach((conv, index) => {
      updateModelInfo(conv.id, { disable: expandedIndex !== -1 && index !== expandedIndex })
    })
  }, [expandedIndex, isMobile, updateModelInfo, conversations.length])

  // 优化 swiper enable 判定
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setAllowSlideNext(!isShowSideBar)
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [isShowSideBar])

  // 结构性变化（会话数量、切换话题）：绘制前同步量好宽度，首帧即为终态
  useLayoutEffect(() => {
    averageListWidth()
  }, [conversations.length, activeTopicId, averageListWidth])

  // 侧边栏有 225ms 宽度过渡，只有这类变化需要等过渡结束再量
  useEffect(() => {
    const debouncedUpdate = debounce(() => {
      averageListWidth()
    }, 220)

    debouncedUpdate()

    return () => {
      debouncedUpdate.cancel()
    }
  }, [sideBarWidth, isShowSideBar, averageListWidth])

  // 当 averageListWidth 变化时，重新绑定 window resize
  useEffect(() => {
    const windowResize = debounce(() => {
      averageListWidth()
    }, 220)

    window.addEventListener('resize', windowResize)

    return () => {
      window.removeEventListener('resize', windowResize)
      windowResize.cancel()
    }
  }, [averageListWidth])

  useEffect(() => {
    if (isMobile) {
      setTimeout(() => setSwiperSlideW(window.innerWidth))
    }
  }, [isMobile])

  // 首帧绘制完成后再开启动画
  useEffect(() => {
    const rafId = requestAnimationFrame(() => setLayoutReady(true))

    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <Box ref={containerRef} sx={customStyle.container}>
      <Box
        sx={{
          ...customStyle.mainBox,
          width: isMobile ? `${swiperSlideW}px` : '100%'
        }}
      >
        {/* 消息展示区域 */}
        {!bootstrapped ? (
          <MessageListSkeleton columnWidths={skeletonWidths} />
        ) : isMobile ? (
          <Swiper
            ref={swiperRef}
            nested
            observer
            observeSlideChildren
            roundLengths
            freeMode={false}
            allowSlideNext={allowSlideNext}
            allowSlidePrev={activeIndex !== 0}
            modules={[Pagination]}
            pagination={{
              dynamicBullets: true
            }}
            slidesPerView={1}
            initialSlide={activeIndex}
            onSlideChange={(swiper: SwiperType) => setActiveIndex(swiper.activeIndex)}
            style={{
              flex: 'auto',
              width: '100%',
              transform: 'translate3d(0, 0, 0)',
              zIndex: 1,
              overflow: 'hidden'
            }}
            onTouchMove={(swiper: SwiperType) => {
              const { diff } = swiper.touches
              if (swiper.swipeDirection === 'prev') {
                // 左滑
                if (diff < 30) return
                activeIndex === 0 && !isShowSideBar && setIsShowSideBar(true)
              } else {
                // 右滑
                if (diff > -30) return
                isShowSideBar && setIsShowSideBar(false)
              }
            }}
          >
            {conversations.map(({ id, atom }) => {
              return (
                <SwiperSlide
                  key={id}
                  style={{
                    transform: 'translate3d(0, 0, 0)',
                    backfaceVisibility: 'hidden'
                  }}
                >
                  <ConversationItem convAtom={atom} swiperRef={swiperRef} />
                </SwiperSlide>
              )
            })}
          </Swiper>
        ) : (
          <Box
            className="none-scrollbar"
            sx={{
              overflowY: 'hidden',
              overflowX: expandedIndex < 0 ? 'auto' : 'hidden',
              position: 'relative',
              flex: 'auto',
              display: 'flex',
              flexDirection: 'row',
              background: 'var(--color-background)'
            }}
          >
            <LayoutGroup>
              <AnimatePresence mode="popLayout" initial={false}>
                {conversations.map(({ id, atom }, index) => {
                  return (
                    <motion.div
                      className="conversation-item-wrapper"
                      data-id={id}
                      key={id}
                      layout={layoutReady ? 'position' : false}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{
                        layout: { type: 'spring', damping: 25, stiffness: 200 },
                        opacity: { duration: 0.15 },
                        scale: { duration: 0.2, ease: 'easeOut' }
                      }}
                      style={{ display: 'flex', height: '100%' }}
                    >
                      <Box
                        sx={{
                          position: 'relative',
                          width: widths.find((w) => w.id === id)?.width ?? fallbackWidth,
                          overflow: 'hidden',
                          height: '100%',
                          flex: 'none',
                          bgcolor: 'var(--color-background)'
                        }}
                      >
                        <ConversationItem convAtom={atom} />
                      </Box>

                      <ResizableDividerMain
                        key={id}
                        index={index}
                        channelsWidth={widths}
                        onResize={(width) => resizeListWidth(index, width)}
                        panelRef={containerRef}
                      />
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </LayoutGroup>

            {/* 右侧预留给外部悬浮 UI 的留白；顶部叠一层和 MessageHeader 同色的吸顶条，
                避免头部背景在这段留白处断开出现接缝。空态不渲染，否则刷新时会先出现一条孤立吸顶条 */}
            {conversations.length > 0 && (
              <Box sx={{ flex: 'none', width: '184px', position: 'relative' }}>
                <Box
                  sx={{
                    position: 'absolute',
                    zIndex: 999,
                    top: 0,
                    left: 0,
                    right: 0,
                    height: UI_CONSTANTS.messageHeaderHeight,
                    background: 'var(--header-overlay-bg)',
                    backdropFilter: 'blur(8px)'
                  }}
                />
              </Box>
            )}
          </Box>
        )}

        <ResizableDivider />

        {viewType === ViewModel.normal ? <EditorPanel /> : <RealtimePanel />}
      </Box>

      <Loading visible={loading} fullScreen={false} />
    </Box>
  )
}

export default React.memo(MainContent)
