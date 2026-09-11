import type { WidthItem } from '@/context/MessageListContext'
import {
  computeViewSwitchWidths,
  cycleViewSwitchLevel,
  getViewSwitchParticipants,
  getViewSwitchScrollOffset
} from './viewSwitch'

// 与 src/store/control.ts 的 UI_CONSTANTS.chatMinWidth/resizeLineWidth 取值保持一致即可，
// computeViewSwitchWidths 本身不依赖 `@/store`（见 viewSwitch.ts 顶部说明），这里独立传入。
const CHAT_MIN_WIDTH = 375
const RESIZE_LINE_WIDTH = 1

const item = (id: string, width: number, orignalWidth = width): WidthItem => ({
  id,
  width,
  orignalWidth
})

const compute = (currentWidths: WidthItem[], participantIds: string[], containerWidth: number) =>
  computeViewSwitchWidths(
    currentWidths,
    participantIds,
    containerWidth,
    CHAT_MIN_WIDTH,
    RESIZE_LINE_WIDTH
  )

describe('getViewSwitchParticipants', () => {
  const ids5 = ['a', 'b', 'c', 'd', 'e']
  const ids3 = ['a', 'b', 'c']

  it('full 档位只返回主控会话自己', () => {
    expect(getViewSwitchParticipants(ids5, 'c', 'full')).toEqual(['c'])
  })

  it('third 档位在中间会话：左右各一个邻居', () => {
    expect(getViewSwitchParticipants(ids5, 'c', 'third')).toEqual(['b', 'c', 'd'])
  })

  it('third 档位在数组第一项：整体滑窗向右，仍凑够3个', () => {
    expect(getViewSwitchParticipants(ids5, 'a', 'third')).toEqual(['a', 'b', 'c'])
  })

  it('third 档位在数组最后一项：整体滑窗向左，仍凑够3个', () => {
    expect(getViewSwitchParticipants(ids5, 'e', 'third')).toEqual(['c', 'd', 'e'])
  })

  it('总共只有3个会话时，third 档位无论点哪一个都是全部3个——与 normal 视觉一致，只是按钮高亮', () => {
    expect(getViewSwitchParticipants(ids3, 'a', 'third')).toEqual(['a', 'b', 'c'])
    expect(getViewSwitchParticipants(ids3, 'b', 'third')).toEqual(['a', 'b', 'c'])
    expect(getViewSwitchParticipants(ids3, 'c', 'third')).toEqual(['a', 'b', 'c'])
  })

  it('half 档位一般情况取右邻', () => {
    expect(getViewSwitchParticipants(ids5, 'b', 'half')).toEqual(['b', 'c'])
    expect(getViewSwitchParticipants(ids5, 'a', 'half')).toEqual(['a', 'b'])
  })

  it('half 档位在主控是数组最后一项时回退取左邻', () => {
    expect(getViewSwitchParticipants(ids5, 'e', 'half')).toEqual(['d', 'e'])
  })

  it('总共只有2个会话时，third/half 都退化为这2个（凑不够3个）', () => {
    expect(getViewSwitchParticipants(['a', 'b'], 'a', 'third')).toEqual(['a', 'b'])
    expect(getViewSwitchParticipants(['a', 'b'], 'b', 'third')).toEqual(['a', 'b'])
    expect(getViewSwitchParticipants(['a', 'b'], 'a', 'half')).toEqual(['a', 'b'])
  })

  it('只有1个会话时的防御分支：返回主控自己', () => {
    expect(getViewSwitchParticipants(['a'], 'a', 'half')).toEqual(['a'])
    expect(getViewSwitchParticipants(['a'], 'a', 'third')).toEqual(['a'])
  })

  it('主控已不在列表中时的防御分支：返回主控自己', () => {
    expect(getViewSwitchParticipants(ids5, 'zzz', 'half')).toEqual(['zzz'])
  })
})

describe('computeViewSwitchWidths', () => {
  it('participantIds 为空数组：全部恢复为各自的 orignalWidth', () => {
    const current = [item('a', 900, 300), item('b', 900, 300), item('c', 100, 300)]
    expect(compute(current, [], 900)).toEqual([
      item('a', 300, 300),
      item('b', 300, 300),
      item('c', 300, 300)
    ])
  })

  it('单参与者（整屏）：不减分隔线宽度，等于容器宽度，其余恢复为 orignalWidth', () => {
    const current = [item('a', 300), item('b', 300), item('c', 300)]
    const result = compute(current, ['b'], 1000)
    expect(result.find((w) => w.id === 'b')?.width).toBe(1000)
    expect(result.find((w) => w.id === 'a')?.width).toBe(300)
    expect(result.find((w) => w.id === 'c')?.width).toBe(300)
  })

  it('2路等分：按 (容器宽度 - 分隔线宽度*n) / n 均分', () => {
    const current = [item('a', 300), item('b', 300), item('c', 300)]
    const result = compute(current, ['a', 'b'], 1000)
    const expected = Math.trunc((1000 - RESIZE_LINE_WIDTH * 2) / 2)
    expect(result.find((w) => w.id === 'a')?.width).toBe(expected)
    expect(result.find((w) => w.id === 'b')?.width).toBe(expected)
    expect(result.find((w) => w.id === 'c')?.width).toBe(300)
  })

  it('3路等分公式与 chatMinWidth 下限', () => {
    const current = [item('a', 300), item('b', 300), item('c', 300)]
    const wide = compute(current, ['a', 'b', 'c'], 1200)
    const expectedWide = Math.trunc((1200 - RESIZE_LINE_WIDTH * 3) / 3)
    expect(wide.every((w) => w.width === expectedWide)).toBe(true)

    // 容器很窄时，按公式算出的宽度低于 chatMinWidth，应被夹到 chatMinWidth
    const narrow = compute(current, ['a', 'b', 'c'], 300)
    expect(narrow.every((w) => w.width === CHAT_MIN_WIDTH)).toBe(true)
  })

  it('非参与会话恢复为各自的 orignalWidth，不清空手动调整过的宽度', () => {
    // b 之前被用户手动拖拽到 500px（orignalWidth=500），本次视图切换与 b 无关
    const current = [item('a', 300, 300), item('b', 500, 500), item('c', 300, 300)]
    const result = compute(current, ['a', 'c'], 1000)
    expect(result.find((w) => w.id === 'b')?.width).toBe(500)
    expect(result.find((w) => w.id === 'b')?.orignalWidth).toBe(500)
  })

  it('从三等分收窄到二等分时，被移出参与集合的会话应恢复为 orignalWidth', () => {
    const current = compute(
      [item('a', 300, 300), item('b', 300, 300), item('c', 300, 300)],
      ['a', 'b', 'c'],
      900
    )
    const next = compute(current, ['b', 'c'], 900)
    expect(next.find((w) => w.id === 'a')?.width).toBe(300) // 恢复为 a 自己的 orignalWidth
  })
})

describe('cycleViewSwitchLevel', () => {
  it('third -> half -> full -> null(normal) 依次循环', () => {
    expect(cycleViewSwitchLevel('third')).toBe('half')
    expect(cycleViewSwitchLevel('half')).toBe('full')
    expect(cycleViewSwitchLevel('full')).toBeNull()
  })
})

describe('getViewSwitchScrollOffset', () => {
  const ids = ['a', 'b', 'c', 'd']

  it('参与组是数组开头：偏移量为0（本就贴左，不需要滚动）', () => {
    const widths = [item('a', 300), item('b', 300), item('c', 900), item('d', 900)]
    expect(getViewSwitchScrollOffset(widths, ids, ['a', 'b'], RESIZE_LINE_WIDTH)).toBe(0)
  })

  it('参与组前面有非参与会话：偏移量累加它们的宽度与各自的分隔线', () => {
    // a(300) + 分隔线(1) 需要滚过去，参与组从 b 开始
    const widths = [item('a', 300), item('b', 500), item('c', 500), item('d', 900)]
    expect(getViewSwitchScrollOffset(widths, ids, ['b', 'c'], RESIZE_LINE_WIDTH)).toBe(301)
  })

  it('单参与者（整屏）在末尾：偏移量累加它前面所有会话+分隔线的宽度', () => {
    const widths = [item('a', 300), item('b', 300), item('c', 300), item('d', 1200)]
    expect(getViewSwitchScrollOffset(widths, ids, ['d'], RESIZE_LINE_WIDTH)).toBe(300 + 1 + 300 + 1 + 300 + 1)
  })
})
