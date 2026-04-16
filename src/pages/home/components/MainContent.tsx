import Loading from '@/components/Loading'
import { useMediaQueryContext } from '@/context/MediaQueryContext'
import { useMessageListContext } from '@/context/MessageListContext'
import { ResizableDivider } from '@/features/common/ResizableDivider'
import { ResizableDividerMain } from '@/features/common/ResizableDividerMain'
import EditorPanel from '@/features/editor/EditorPanel'
import RealtimePanel from '@/features/media/RealtimePanel'
import {
  UI_CONSTANTS,
  activeTopicIdAtom,
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pagination } from 'swiper/modules'
import { Swiper, SwiperSlide, type SwiperRef } from 'swiper/react'
import { Swiper as SwiperType } from 'swiper/types'
import MessageList from './MessageList'

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

const HomeRightPanel = () => {
  const { isMobile } = useMediaQueryContext()
  const { widths, setWidths } = useMessageListContext()
  const activeTopicId = useAtomValue(activeTopicIdAtom)
  const loading = useAtomValue(loadingAtom)
  const sideBarWidth = useAtomValue<number>(sideBarWidthAtom)
  const [isShowSideBar, setIsShowSideBar] = useAtom(isShowSideBarAtom)
  const viewType = useAtomValue(viewTypeAtom)
  const conversations = useAtomValue(checkedConversationsAtom)
  const [activeIndex, setActiveIndex] = useState(0)
  const [allowSlideNext, setAllowSlideNext] = useState(true)
  const [swiperSlideW, setSwiperSlideW] = useState(window.innerWidth)

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

  // 优化 swiper enable 判定
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setAllowSlideNext(!isShowSideBar)
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [isShowSideBar])

  // 消息列表宽度均分时机
  useEffect(() => {
    const debouncedUpdate = debounce(() => {
      averageListWidth()
    }, 220)

    debouncedUpdate()

    return () => {
      debouncedUpdate.cancel()
    }
  }, [sideBarWidth, isShowSideBar, conversations.length, activeTopicId, averageListWidth])

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

  return (
    <Box ref={containerRef} sx={customStyle.container}>
      <Box
        sx={{
          ...customStyle.mainBox,
          width: isMobile ? `${swiperSlideW}px` : '100%'
        }}
      >
        {/* 消息展示区域 */}
        {isMobile ? (
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
              overflowX: 'auto',
              position: 'relative',
              flex: 'auto',
              display: 'flex',
              flexDirection: 'row',
              pr: '184px',
              background: conversations.length > 0 ? 'var(--color-background)' : '#fff'
            }}
          >
            <LayoutGroup>
              <AnimatePresence mode="popLayout">
                {conversations.map(({ id, atom }, index) => {
                  return (
                    <motion.div
                      className="conversation-item-wrapper"
                      data-id={id}
                      key={id}
                      layout="position"
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
                          width: widths[index]?.width,
                          overflow: 'hidden',
                          height: '100%',
                          flex: 'none',
                          bgcolor: '#fff'
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
          </Box>
        )}

        <ResizableDivider />

        {viewType === ViewModel.normal ? <EditorPanel /> : <RealtimePanel />}
      </Box>

      <Loading visible={loading} fullScreen={false} />
    </Box>
  )
}

export default React.memo(HomeRightPanel)
