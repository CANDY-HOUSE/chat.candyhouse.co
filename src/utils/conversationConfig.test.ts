import type { IModelInfo } from '@/types/messagetypes'
import {
  CONV_NAME_MAX_LENGTH,
  mergeConvConfig,
  resolveConversationTitle,
  sanitizeConversationName
} from './conversationConfig'

const model = (over: Partial<IModelInfo> = {}): IModelInfo => ({
  modelName: 'gpt-5',
  ...over
})

describe('resolveConversationTitle', () => {
  it('无 modelInfo 时返回空串', () => {
    expect(resolveConversationTitle()).toBe('')
    expect(resolveConversationTitle(null)).toBe('')
  })

  it('按 convConfig.name → alias → modelName 的优先级解析', () => {
    expect(resolveConversationTitle(model())).toBe('gpt-5')
    expect(resolveConversationTitle(model({ alias: 'GPT-5' }))).toBe('GPT-5')
    expect(
      resolveConversationTitle(model({ alias: 'GPT-5', convConfig: { name: '我的会话' } }))
    ).toBe('我的会话')
  })

  it('去除首尾空白', () => {
    expect(resolveConversationTitle(model({ convConfig: { name: '  我的会话  ' } }))).toBe('我的会话')
    expect(resolveConversationTitle(model({ alias: '  GPT-5  ' }))).toBe('GPT-5')
  })

  it('纯空白的 name / alias 视为缺省并继续回退', () => {
    expect(resolveConversationTitle(model({ alias: 'GPT-5', convConfig: { name: '   ' } }))).toBe(
      'GPT-5'
    )
    expect(resolveConversationTitle(model({ alias: '   ', convConfig: { name: '  ' } }))).toBe(
      'gpt-5'
    )
  })
})

describe('sanitizeConversationName', () => {
  it('非字符串一律返回 undefined', () => {
    expect(sanitizeConversationName()).toBeUndefined()
    expect(sanitizeConversationName(null)).toBeUndefined()
    expect(sanitizeConversationName(123)).toBeUndefined()
    expect(sanitizeConversationName({ name: 'x' })).toBeUndefined()
  })

  it('把 LLM 返回的多行文本折叠成单行', () => {
    expect(sanitizeConversationName('  关于\n  部署  流程 ')).toBe('关于 部署 流程')
  })

  it('空串与纯空白归一为 undefined（回退默认名）', () => {
    expect(sanitizeConversationName('')).toBeUndefined()
    expect(sanitizeConversationName('   \n  ')).toBeUndefined()
  })

  it(`截断到 CONV_NAME_MAX_LENGTH（${CONV_NAME_MAX_LENGTH}）`, () => {
    const long = 'a'.repeat(CONV_NAME_MAX_LENGTH + 10)
    expect(sanitizeConversationName(long)).toHaveLength(CONV_NAME_MAX_LENGTH)
    expect(sanitizeConversationName('b'.repeat(CONV_NAME_MAX_LENGTH))).toHaveLength(
      CONV_NAME_MAX_LENGTH
    )
  })

  // 固化当前实现的边界行为：先 trim 再 slice，因此截断点若落在空格上会留下尾随空格。
  it('截断点落在空格上时会保留尾随空格（当前实现行为）', () => {
    const raw = `${'a'.repeat(CONV_NAME_MAX_LENGTH - 1)} bcd`
    expect(sanitizeConversationName(raw)).toBe(`${'a'.repeat(CONV_NAME_MAX_LENGTH - 1)} `)
  })
})

describe('mergeConvConfig', () => {
  it('draft 无 convConfig 时以 patch 建立', () => {
    expect(mergeConvConfig(model(), { name: '新会话' })).toEqual({
      convConfig: { name: '新会话' }
    })
  })

  it('patch 覆盖同名字段', () => {
    expect(mergeConvConfig(model({ convConfig: { name: '旧' } }), { name: '新' })).toEqual({
      convConfig: { name: '新' }
    })
  })

  // 这是 mergeConvConfig 存在的理由：直接传 { convConfig: {...} } 会整块替换，
  // 未来新增的会话级字段会被互相覆盖。此用例守护"patch 未提及的字段必须保留"。
  it('保留 patch 未提及的既有字段', () => {
    const draft = model({ convConfig: { name: '旧', futureField: 'keep' } as never })
    expect(mergeConvConfig(draft, {})).toEqual({
      convConfig: { name: '旧', futureField: 'keep' }
    })
    expect(mergeConvConfig(draft, { name: '新' })).toEqual({
      convConfig: { name: '新', futureField: 'keep' }
    })
  })

  it('不修改传入的 draft', () => {
    const draft = model({ convConfig: { name: '旧' } })
    mergeConvConfig(draft, { name: '新' })
    expect(draft.convConfig).toEqual({ name: '旧' })
  })

  it('只返回 convConfig 一个键', () => {
    expect(Object.keys(mergeConvConfig(model({ alias: 'GPT-5' }), { name: 'x' }))).toEqual([
      'convConfig'
    ])
  })
})
