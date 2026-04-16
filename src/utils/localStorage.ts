import { logger } from '@utils'

export const localKey = {
  language: 'language',
  theme: 'theme',
  fontSize: 'fontSize',
  editorHeight: 'editorHeight',
  sideBarWidth: 'sideBarWidth',
  editorDrafts: 'editorDrafts',
  editorHistory: 'editorHistory',
  limitCount: 'limitCount',
  limitCountLastReset: 'limitCountLastReset',
  uuid: 'uuid'
}

export const getLocalValue = <T = unknown>(key: string): T | null => {
  try {
    const value = localStorage.getItem(key)
    if (!value) return null

    try {
      return JSON.parse(value) as T
    } catch (parseError) {
      logger.error(`Error parsing localStorage key "${key}":`, parseError)
      return null
    }
  } catch (error) {
    logger.error(`Error getting localStorage key "${key}":`, error)
    return null
  }
}

export const putLocalValue = (key: string, value: any): boolean => {
  try {
    const jsonString = JSON.stringify(value)
    localStorage.setItem(key, jsonString)
    return true
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      logger.error(`localStorage quota exceeded when setting key "${key}"`)
    } else {
      logger.error(`Error setting localStorage key "${key}":`, error)
    }
    return false
  }
}

export const clearAllLocalStorage = (): void => {
  try {
    localStorage.clear()
    logger.info('All localStorage data cleared')
  } catch (error) {
    logger.error('Error clearing localStorage:', error)
  }
}
