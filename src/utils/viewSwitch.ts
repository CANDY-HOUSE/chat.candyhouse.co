import type { ViewSwitchLevel, WidthItem } from '@/context/MessageListContext'

// 给定当前顺序、主控会话id、档位，返回参与显示的会话id（保持数组原有前后顺序）。
// 用"滑动窗口"统一 half（窗口宽2）/third（窗口宽3）：优先让 owner 居中——half 是
// "owner 在窗口最左"（即取右邻），third 是"owner 居中"（左右各一个邻居）——窗口
// 越界时整体平移，而不是收窄窗口。这保证只要总数够，half 恒为2个、third 恒为3个，
// 边界会话和中间会话的点击体验完全一致（例如3个会话时，任何一个被点击，third 档
// 都是全部3个一起显示，视觉上和 normal 一样，只是按钮高亮——不会出现"third 在边界
// 退化成和 half 一样的2个"，导致点两下看起来像没反应）。
export const getViewSwitchParticipants = (
  orderedIds: string[],
  ownerId: string,
  level: ViewSwitchLevel
): string[] => {
  const idx = orderedIds.indexOf(ownerId)
  if (idx === -1) return [ownerId] // 防御：owner 已不在列表中，调用方应已用 guard 提前处理
  if (level === 'full') return [ownerId]

  const n = orderedIds.length
  const size = Math.min(level === 'third' ? 3 : 2, n)
  const preferredStart = level === 'third' ? idx - 1 : idx
  const start = Math.max(0, Math.min(preferredStart, n - size))

  return orderedIds.slice(start, start + size)
}

// 只覆盖参与会话的 width，非参与会话一律恢复为它自己的 orignalWidth
// （可能是均分值，也可能是用户手动拖拽过的自定义值）——绝不touch orignalWidth 本身，
// 避免视图切换的点击/拖拽排序清空与本次操作无关的会话的手动宽度。
// chatMinWidth/resizeLineWidth 以参数传入（而不是在这里直接 import UI_CONSTANTS）：
// `@/store` 的模块图会经由 `@config`/`@constants`/`@utils` 等别名深度依赖 webpack 的
// alias 配置，而 Jest 走的是未经 craco 包装的 `react-scripts test`，无法解析这些别名；
// 保持这个模块零依赖，调用方（运行在 webpack 下）自己从 `@/store` 取值传入即可。
export const computeViewSwitchWidths = (
  currentWidths: WidthItem[],
  participantIds: string[],
  containerWidth: number,
  chatMinWidth: number,
  resizeLineWidth: number
): WidthItem[] => {
  if (participantIds.length === 0) {
    return currentWidths.map((item) => ({ ...item, width: item.orignalWidth }))
  }
  if (participantIds.length === 1) {
    const soleId = participantIds[0]
    return currentWidths.map((item) =>
      item.id === soleId ? { ...item, width: containerWidth } : { ...item, width: item.orignalWidth }
    )
  }
  const n = participantIds.length
  const equalWidth = Math.max(chatMinWidth, Math.trunc((containerWidth - resizeLineWidth * n) / n))
  const participantSet = new Set(participantIds)
  return currentWidths.map((item) =>
    participantSet.has(item.id) ? { ...item, width: equalWidth } : { ...item, width: item.orignalWidth }
  )
}

const LEVEL_ORDER: ViewSwitchLevel[] = ['third', 'half', 'full']

// 按钮循环：third → half → full → null(normal)
export const cycleViewSwitchLevel = (level: ViewSwitchLevel): ViewSwitchLevel | null => {
  const idx = LEVEL_ORDER.indexOf(level)
  return idx === LEVEL_ORDER.length - 1 ? null : LEVEL_ORDER[idx + 1]!
}

// 参与会话组的宽度总和恰好等于 containerWidth（见 computeViewSwitchWidths），所以
// 只要把参与组的第一个会话滚动到贴左，整组就会同时贴左也贴右——不需要区分 owner
// 在参与组里靠左/居中/靠右。故意不用 scrollIntoView 读取实时 DOM 几何：切换视图时
// 会话正在经历 framer-motion 的布局弹簧动画，动画过程中的几何是"过渡态"，用它反推
// 出的滚动位置在动画结束后就对不上了（尤其是宽度变化幅度大的切换）。这里直接从
// "即将生效的目标宽度"这份数据算出滚动量，跟动画进度无关。
export const getViewSwitchScrollOffset = (
  targetWidths: WidthItem[],
  orderedIds: string[],
  participantIds: string[],
  resizeLineWidth: number
): number => {
  const firstParticipantId = participantIds[0]
  const widthMap = new Map(targetWidths.map((w) => [w.id, w.width]))

  let offset = 0
  for (const id of orderedIds) {
    if (id === firstParticipantId) break
    offset += (widthMap.get(id) ?? 0) + resizeLineWidth
  }
  return offset
}
