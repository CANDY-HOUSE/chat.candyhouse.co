import { apiGetModelSelect, apiModelPromote } from '@/api'
import { modelSelectAtom, store } from '@/store'
import { useCallback } from 'react'

export const useModel = () => {
  // 获取模型真实名称（处理被替代的模型）
  const getModelName = useCallback((modelName: string) => {
    const currentModelSelect = store.get(modelSelectAtom)
    const model = currentModelSelect.find((model) => model.modelName === modelName)
    const ret = model?.replacedBy || modelName

    return ret
  }, [])

  // 升级模型（PREVIEW → ACTIVE）
  const promoteModel = useCallback(async (email: string) => {
    const result = await apiModelPromote(email)
    if (!result) return false
    const modelSelectRes = await apiGetModelSelect('all', { sortOrder: 'asc' })
    store.set(modelSelectAtom, modelSelectRes?.items || [])
    return true
  }, [])

  return {
    getModelName,
    promoteModel
  }
}
