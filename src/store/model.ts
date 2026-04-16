import type { IConversation, IModel, ITopics } from '@/types/messagetypes'
import { ModelStatus } from '@constants'
import { atom, type PrimitiveAtom } from 'jotai'
import { atomFamily, splitAtom } from 'jotai/utils'
import { store } from './index'

// 话题列表
export const topicsAtom = atom<Array<ITopics>>([])

// 当前激活话题
export const activeTopicIdAtom = atom<string | null>(null)

// 全量会话列表
export const conversationsFamily = atomFamily((_topicId: string) => atom<IConversation[]>([]))

// 原子化会话列表
export const conversationsAtomsFamily = atomFamily((topicId: string) =>
  splitAtom(conversationsFamily(topicId), (c: IConversation) => c.conversationId)
)

// 当前勾选的原子化会话列表
export const checkedConversationsAtom = atom((get) => {
  const topicId = get(activeTopicIdAtom)
  if (!topicId) return [] as Array<{ id: string; atom: PrimitiveAtom<IConversation> }>

  const topics = get(topicsAtom)
  const checked = topics.find((t) => t.id === topicId)?.models ?? []
  const itemAtoms = get(conversationsAtomsFamily(topicId))

  const pairs = itemAtoms
    .map((a) => [a, get(a)] as const)
    .filter(([, conv]) => checked.includes(conv.modelId))

  pairs.sort(([, a], [, b]) => {
    const orderA = a.order ?? 0
    const orderB = b.order ?? 0
    return orderA <= orderB ? 1 : -1
  })

  return pairs.map(([a, conv]) => ({ id: conv.conversationId, atom: a }))
})

const emptyConversationsAtom = atom<IConversation[]>([])
// 当前激活话题的全量会话
export const conversationsAtom = atom((get) => {
  const id = get(activeTopicIdAtom)
  if (!id) return get(emptyConversationsAtom)

  return get(conversationsFamily(id))
})

// 正在运行中的模型
export const workingModelsAtom = atom((get) => {
  const topics = get(topicsAtom)
  const workingModels: Array<{ id: string; atom: PrimitiveAtom<IConversation> }> = []

  topics.forEach((topic) => {
    const itemAtoms = get(conversationsAtomsFamily(topic.id))

    itemAtoms.forEach((atom) => {
      const conv = get(atom)
      if (conv.modelInfo.atWork) {
        workingModels.push({ id: conv.conversationId, atom })
      }
    })
  })

  return workingModels
})

// 当前是否有正在运行的模型
export const hasModelAtWorkAtom = atom((get) => {
  return get(workingModelsAtom).length > 0
})

// 清空所有话题的会话
export const clearAllConversations = () => {
  const topics = store.get(topicsAtom)
  topics.forEach((topic) => {
    store.set(conversationsFamily(topic.id), [])
  })
}

// 模型配置select
export const modelSelectAtom = atom<Array<IModel>>([])

// 模型配置select - active
export const activeModelSelectAtom = atom((get) => {
  const modelSelect = get(modelSelectAtom)
  if (modelSelect.length < 1) return [] as IModel[]

  return modelSelect.filter((model) => model.status === ModelStatus.ACTIVE)
})

export const resetModelData = () => {
  store.set(topicsAtom, [])
  clearAllConversations()
}
