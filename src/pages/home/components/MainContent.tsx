import Loading from '@/components/Loading'
import { useMediaQueryContext } from '@/context/MediaQueryContext'
import { useMessageListContext, type WidthItem } from '@/context/MessageListContext'
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
import {
  computeViewSwitchWidths,
  getViewSwitchParticipants,
  getViewSwitchScrollOffset
} from '@/utils'
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
  const { widths, setWidths, viewSwitch, setViewSwitch } = useMessageListContext()
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
  // 真正横向滚动的那一层（会话行本身）；containerRef 是它的祖先容器，只用来读取
  // "可用宽度"——程序化滚动必须作用在真正设了 overflowX 的这层上，不能用 containerRef。
  const scrollRowRef = useRef<HTMLDivElement>(null)
  const swiperRef = useRef<SwiperRef>(null)
  const conversationsRef = useRef(conversations)
  conversationsRef.current = conversations
  const viewSwitchRef = useRef(viewSwitch)
  viewSwitchRef.current = viewSwitch
  const widthsRef = useRef(widths)
  widthsRef.current = widths

  // 会话顺序的稳定 key：数量不变但拖拽排序改变了顺序时也会变化，
  // 用于驱动视图切换的邻居重算（见 applyViewSwitch）
  const orderKey = useMemo(() => conversations.map((c) => c.id).join(','), [conversations])

  // 结构性变化（会话数量、切换话题）与"纯 viewSwitch/纯拖拽排序"必须走同一个 effect
  // 判断分支、而不是两个各自独立的 effect：话题切换时 activeTopicId 和 orderKey 会
  // 同时变化，若分成两个 effect，两者会在同一次 commit 里都触发，后一个读到的
  // widthsRef.current 还是上一次渲染的旧值（ref 要等下一次渲染才会同步），会用
  // 旧话题的 widths 覆盖掉前一个 effect 刚算好的新话题基线。
  const hasBaselineRef = useRef(false)
  const prevTopicIdRef = useRef(activeTopicId)
  const prevCountRef = useRef(conversations.length)

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
          return <MessageList swiperRef={swiperRef} conversation={conversation} />
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

  // 视图切换覆盖：只覆盖参与会话的 width，非参与会话恢复为各自 orignalWidth，
  // 绝不重算均分基线——避免清空与本次操作无关的会话的手动自定义宽度。
  // 由"viewSwitch/会话顺序变化"（点击/拖拽排序）和"均分基线重算后需要重新叠加"两类场景触发；
  // 后一种场景（见 averageListWidth）会把刚算好的新基线通过 baseWidths 显式传入——
  // 不能依赖 widthsRef.current，那是上一次渲染时的旧值，此时还没被 setWidths 同步过来。
  const applyViewSwitch = useCallback(
    (baseWidths?: WidthItem[]) => {
      if (!containerRef.current) return
      const base = baseWidths ?? widthsRef.current

      const ids = conversationsRef.current.map((c) => c.id)
      const owner = viewSwitchRef.current
      const ownerPresent = !!owner && ids.includes(owner.ownerId)
      // 主控会话已不存在（被删/话题切走），或只剩1个会话：回归 normal，
      // 避免残留状态在后续新增会话时"复活"
      const effectiveOwner = owner && ownerPresent && ids.length > 1 ? owner : null
      if (owner && !effectiveOwner) setViewSwitch(null)

      const participants = effectiveOwner
        ? getViewSwitchParticipants(ids, effectiveOwner.ownerId, effectiveOwner.level)
        : []
      const containerWidth = containerRef.current.offsetWidth
      const nextWidths = computeViewSwitchWidths(
        base,
        participants,
        containerWidth,
        UI_CONSTANTS.chatMinWidth,
        UI_CONSTANTS.resizeLineWidth
      )
      setWidths(nextWidths)

      if (participants.length > 0) {
        const offset = getViewSwitchScrollOffset(nextWidths, ids, participants, UI_CONSTANTS.resizeLineWidth)
        // 用目标宽度直接算出的偏移量去滚动，不用 scrollIntoView 读取实时 DOM 几何——
        // 切换瞬间会话正在走 framer-motion 的布局弹簧动画，几何是过渡态，算出来的
        // 位置动画结束后会对不上。两帧 rAF 只是等 React 把 nextWidths 提交到 DOM
        // （MessageList.tsx 的 loadMore 里也用同样的双 rAF 等一次状态更新落到 DOM），
        // 和布局动画本身是否播完无关。
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollRowRef.current?.scrollTo({ left: offset, behavior: 'smooth' })
          })
        })
      }
    },
    [setWidths, setViewSwitch]
  )

  // 均分各消息列表宽度：算好的新基线始终交给 applyViewSwitch 落地（非 viewSwitch 状态下，
  // participants 为空，等价于原样应用基线），避免基线和视图切换覆盖各自独立调用 setWidths
  const averageListWidth = useCallback(() => {
    const cLength = conversationsRef.current.length
    if (!containerRef.current || cLength === 0) return

    const newTotalWidth = containerRef.current.offsetWidth
    const equalWidth = Math.trunc((newTotalWidth - UI_CONSTANTS.resizeLineWidth * cLength) / cLength)

    const baseline = conversationsRef.current.map((conv) => {
      const width = equalWidth < UI_CONSTANTS.chatMinWidth ? UI_CONSTANTS.chatMinWidth : equalWidth
      return { id: conv.id, width, orignalWidth: width }
    })

    applyViewSwitch(baseline)
  }, [applyViewSwitch])

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

  // 监听视图切换：禁用当前不在参与集合内的会话（非normal视图下，非参与会话既不可见也不可交互，
  // EditorPanel 靠 modelInfo.disable 判断新消息该发给哪些会话，这里算错是功能性问题，不只是视觉问题）
  useEffect(() => {
    if (isMobile) return

    const ids = conversationsRef.current.map((c) => c.id)
    const participants = viewSwitch
      ? new Set(getViewSwitchParticipants(ids, viewSwitch.ownerId, viewSwitch.level))
      : null

    conversationsRef.current.forEach((conv) => {
      updateModelInfo(conv.id, { disable: participants !== null && !participants.has(conv.id) })
    })
  }, [viewSwitch, isMobile, updateModelInfo, orderKey])

  // 优化 swiper enable 判定
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setAllowSlideNext(!isShowSideBar)
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [isShowSideBar])

  // 会话数量变化或切换话题：重算均分基线（首帧即为终态）；纯拖拽排序（数量、话题都
  // 不变，只是 orderKey 变了）或 viewSwitch 状态变化：只重新计算参与会话的宽度覆盖，
  // 不碰均分基线，不清空其他会话手动调整过的宽度。用 useLayoutEffect 保证"主控会话
  // 已不存在→回归normal"这类重置在绘制前完成，不会闪一帧错误布局。
  useLayoutEffect(() => {
    const isStructural =
      !hasBaselineRef.current ||
      prevTopicIdRef.current !== activeTopicId ||
      prevCountRef.current !== conversations.length

    hasBaselineRef.current = true
    prevTopicIdRef.current = activeTopicId
    prevCountRef.current = conversations.length

    if (isStructural) {
      averageListWidth()
    } else {
      applyViewSwitch()
    }
  }, [orderKey, activeTopicId, conversations.length, viewSwitch, averageListWidth, applyViewSwitch])

  // 桌面态分屏激活时，若免刷新切到移动宽度，回归 normal，避免状态隐形挂起、切回桌面宽度时复现
  useEffect(() => {
    if (isMobile) setViewSwitch(null)
  }, [isMobile, setViewSwitch])

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
            ref={scrollRowRef}
            className="none-scrollbar"
            sx={{
              overflowY: 'hidden',
              overflowX: viewSwitch === null ? 'auto' : 'hidden',
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
                        disabled={viewSwitch !== null}
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
