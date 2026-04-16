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

  return {
    getModelName
  }
}
