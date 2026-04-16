import type { BeanVersionInfo } from '@/types/beantypes'
import { config } from '@config'
import { ViewModel } from '@constants'
import { getLocalValue, localKey, logger, putLocalValue } from '@utils'
import { atom, type WritableAtom } from 'jotai'
import i18n from '../i18n'

// ========== Constants ==========
export const UI_CONSTANTS = {
  resizeLineWidth: 1,
  baseFontSize: 16,
  editorHeight: 306,
  mobileEditorHeight: 90,
  sideBarWidth: 310,
  mobileSideBarWidth: 220,
  chatMinWidth: 375 // 对话列表最小宽度
} as const

// ========== Utility Functions ==========
/**
 * 创建一个与本地存储同步的 atom
 * @param key - 本地存储的键
 * @param defaultValue - 默认值
 * @param transform - 值变化时的转换函数
 */
function createLocalStorageAtom<T>(
  key: string,
  defaultValue: T,
  transform?: (value: T) => void
): WritableAtom<T, [T], void> {
  const baseAtom = atom<T>((getLocalValue(key) as T) ?? defaultValue)

  return atom(
    (get) => get(baseAtom),
    (_get, set, newValue: T) => {
      set(baseAtom, newValue)
      putLocalValue(key, newValue)
      transform?.(newValue)
    }
  )
}

// ========== UI Layout Atoms ==========
export const isShowSideBarAtom = atom<boolean>(false)
export const editorExpandedAtom = atom<boolean>(false)
export const focusMessageAtom = atom<{ messageId: string; conversationId: string } | null>(null)

// ========== Size Configuration Atoms ==========
export const editorHeightAtom = createLocalStorageAtom<number>(
  localKey.editorHeight,
  UI_CONSTANTS.editorHeight
)

export const sideBarWidthAtom = createLocalStorageAtom<number>(
  localKey.sideBarWidth,
  UI_CONSTANTS.sideBarWidth
)

// ========== Language & Font Atoms ==========
export const languageAtom = createLocalStorageAtom<string>(
  localKey.language,
  config.defaultLanguage,
  (newValue) => i18n.changeLanguage(newValue)
)

export const fontSizeAtom = createLocalStorageAtom<number>(
  localKey.fontSize,
  UI_CONSTANTS.baseFontSize
)

// ========== Async Atoms ==========
export const versionInfo = atom(async () => {
  try {
    const response = await fetch('/version.json')
    if (!response.ok) {
      throw new Error(`Failed to fetch version: ${response.statusText}`)
    }
    const res: BeanVersionInfo = await response.json()
    return res
  } catch (err) {
    logger.error('Failed to fetch version info:', err)
    return null
  }
})

// ========== Voice & Realtime Atoms ==========
export const viewTypeAtom = atom<ViewModel>(ViewModel.normal)
export const realtimStatusAtom = atom<string>('')
export const devtoolVisibleAtom = atom<boolean>(false)

// ========== Others ==========
export const imagePreviewSrcsAtom = atom<Array<string>>()

export const resetUISettings = () => {
  putLocalValue(localKey.editorHeight, UI_CONSTANTS.editorHeight)
  putLocalValue(localKey.sideBarWidth, UI_CONSTANTS.sideBarWidth)
  putLocalValue(localKey.fontSize, UI_CONSTANTS.baseFontSize)
}
