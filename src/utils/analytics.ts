import { getLocalValue, localKey } from './localStorage'

/**
 * 增强 GA4 事件参数，自动添加用户邮箱
 * @param params 原始事件参数
 * @returns 增强后的事件参数
 */
export const enhanceEventParams = (params?: Record<string, any>): Record<string, any> => {
  const { store, userAtom } = require('@/store')
  const user = store.get(userAtom)
  const uuid = getLocalValue(localKey.uuid)

  return {
    ...params,
    is_login: user?.isLogin ? 1 : 0,
    u_id: uuid
  }
}
