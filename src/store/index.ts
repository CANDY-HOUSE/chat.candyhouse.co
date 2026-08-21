import type { BeanUser } from '@/types/beantypes'
import { atom, createStore } from 'jotai'
import { resetUISettings } from './control'
import { resetFeedback } from './feedBack'
import { resetModelData } from './model'

// 创建 store 实例
export const store = createStore()

// ========== 全局状态 Atoms ==========
// 用户相关
export const userAtom = atom<BeanUser | null>(null)

// 鉴权阶段：'pending' 表示还没问过 Cognito。
// userAtom 的 null 无法和「确认未登录」区分，bootstrap 逻辑必须依赖这个三态而不是 user?.isLogin
export const authStatusAtom = atom<'pending' | 'authed' | 'guest'>('pending')

// 首屏数据（话题 → 会话 → 消息）是否已就绪。
// 侧边栏和主内容区共用这一个骨架屏开关，避免两边各自维护 loading 而错位
export const bootstrappedAtom = atom(false)

// 加载状态
export const loadingAtom = atom(false)

let loadingCount = 0
let hideTimer: NodeJS.Timeout | null = null

export const showLoading = (): void => {
  loadingCount++
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  if (loadingCount === 1) {
    store.set(loadingAtom, true)
  }
}

export const hideLoading = (): void => {
  loadingCount = Math.max(0, loadingCount - 1)
  if (loadingCount === 0) {
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      store.set(loadingAtom, false)
    }, 300) // 300ms 延迟隐藏，避免闪烁
  }
}

// ========== 重置所有 Atoms ==========
export const resetAllAtoms = (): void => {
  // 重置用户状态
  store.set(userAtom, null)
  store.set(authStatusAtom, 'pending')

  // 重置加载状态
  store.set(bootstrappedAtom, false)
  store.set(loadingAtom, false)

  // 重置 model 状态
  resetModelData()

  // 重置弹窗状态
  resetFeedback()

  // 重置 ui 状态
  resetUISettings()
}

// ========== 导出其他 Atoms ==========
export * from './control'
export * from './feedBack'
export * from './model'
export * from './theme'
