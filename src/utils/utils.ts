import { isBoolean, isEmpty, isNumber, isObject } from 'lodash-es'
import { v4 as uuidv4 } from 'uuid'
import { logger } from './logger'

const getUUID = (): string => uuidv4()

const generateFileKey = (type: string) => `${type}-${crypto.randomUUID()}`

const checkEmail = (email: string): boolean =>
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{1,}))$/.test(
    email
  )

const copyText = async (text: string) => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard
      .writeText(text)
      .then(() => {
        return true
      })
      .catch(() => {
        return fallbackCopyToClipboard(text)
      })
  } else {
    return fallbackCopyToClipboard(text)
  }
}

function fallbackCopyToClipboard(text: string) {
  const textArea = document.createElement('textarea')
  textArea.value = text

  textArea.style.position = 'fixed'
  textArea.style.top = '0'
  textArea.style.left = '0'
  textArea.style.width = '2em'
  textArea.style.height = '2em'
  textArea.style.padding = '0'
  textArea.style.border = 'none'
  textArea.style.outline = 'none'
  textArea.style.boxShadow = 'none'
  textArea.style.background = 'transparent'

  document.body.appendChild(textArea)

  textArea.focus()
  textArea.select()

  try {
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return successful
  } catch {
    document.body.removeChild(textArea)
    return false
  }
}

// 将单张图片转 base64
const imgToBase64 = (img: HTMLImageElement): Promise<string> => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = img.src
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      canvas.getContext('2d')!.drawImage(image, 0, 0)
      resolve(canvas.toDataURL())
    }
    image.onerror = reject
  })
}

const copyRichText = async (contentRef: React.RefObject<HTMLElement | null>) => {
  if (!contentRef.current) return false

  try {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    const textContent = contentRef.current.innerText || contentRef.current.textContent || ''

    if (isMobile) {
      return await copyText(textContent)
    }

    if (!window.isSecureContext) {
      logger.warn('Clipboard API requires secure context (HTTPS)')
    }

    if (!navigator.clipboard || !navigator.clipboard.write) {
      throw new Error('Clipboard API not supported')
    }

    const htmlContent = contentRef.current.innerHTML

    // 检查是否包含图片
    const images = contentRef.current.querySelectorAll('img')

    if (images.length > 0) {
      const clonedNode = contentRef.current.cloneNode(true) as HTMLElement
      const clonedImages = clonedNode.querySelectorAll('img')

      try {
        for (let i = 0; i < clonedImages.length; i++) {
          const img = clonedImages[i]!
          img.src = await imgToBase64(img)
        }

        const enhancedHtml = clonedNode.innerHTML

        // 创建包含增强 HTML 的 ClipboardItem
        const clipboardItem = new ClipboardItem({
          'text/html': new Blob([enhancedHtml], { type: 'text/html' }),
          'text/plain': new Blob([textContent], { type: 'text/plain' })
        })

        navigator.clipboard.write([clipboardItem])
        return true
      } catch (enhanceErr) {
        logger.warn(enhanceErr)
      }
    }

    // 创建 ClipboardItem 对象
    const clipboardItem = new ClipboardItem({
      'text/html': new Blob([htmlContent], { type: 'text/html' }),
      'text/plain': new Blob([textContent], { type: 'text/plain' })
    })

    navigator.clipboard.write([clipboardItem])
    return true
  } catch {
    // 回退到传统方法
    try {
      // 创建临时 textarea
      const textarea = document.createElement('textarea')
      textarea.value = contentRef.current?.innerText || contentRef.current?.textContent || ''
      textarea.style.cssText = `
        position: fixed;
        left: -9999px;
        top: 0;
        opacity: 0;
      `

      document.body.appendChild(textarea)

      // iOS 需要先聚焦
      textarea.focus()
      textarea.select()

      const success = document.execCommand('copy')
      document.body.removeChild(textarea)

      return success
    } catch (err) {
      logger.error('Copy failed:', err)
      return false
    }
  }
}

const utcToReadable = (utcString: string) => {
  // 创建Date对象
  const date = new Date(utcString)

  // 获取本地时间部分（时:分:秒）
  const timePart = date.toLocaleTimeString('zh-CN', { hour12: false })

  // 获取本地日期部分（年-月-日）
  const datePart = date.toLocaleDateString('zh-CN')

  // 拼接格式：时间 日期
  return `${timePart} ${datePart}`
}

const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

// 根据 url 获取网页 favicons
const getFaviconUrl = (url: string, title?: string) => {
  const domain = title
    ? title.replace(/^www\./, '')
    : (() => {
        try {
          return new URL(url).hostname
        } catch {
          return ''
        }
      })()
  if (!domain) return ''
  return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`
}

// 深度清理对象中的空值
const cleanDeep = <T extends Record<string, unknown> | unknown[]>(obj: T): T => {
  // 处理数组
  if (Array.isArray(obj)) {
    return obj
      .map((item) => (isObject(item) ? cleanDeep(item as Record<string, unknown>) : item))
      .filter((item) => {
        const isActuallyEmpty = isEmpty(item) && !isNumber(item) && !isBoolean(item)
        return !isActuallyEmpty
      }) as T
  }

  // 处理对象
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const cleanedValue = isObject(value) ? cleanDeep(value as Record<string, unknown>) : value
    const isActuallyEmpty =
      isEmpty(cleanedValue) && !isNumber(cleanedValue) && !isBoolean(cleanedValue)

    if (!isActuallyEmpty) {
      result[key] = cleanedValue
    }
  }
  return result as T
}

const fileToBase64 = async (file: File, includePrefix: boolean = true): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (includePrefix) {
          resolve(reader.result)
        } else {
          // 移除 data:xxx;base64, 前缀
          const base64Data = reader.result.split(',')[1] || reader.result
          resolve(base64Data)
        }
      } else {
        reject(new Error('File could not be read as a string'))
      }
    }
    reader.onerror = (error) => reject(error)
  })
}

const base64ToFile = async (base64: string, fileName: string): Promise<File> => {
  let base64Data = base64

  if (!base64Data.startsWith('data:')) {
    const ext = fileName.split('.').pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp'
    }
    const mimeType = mimeTypes[ext || ''] || 'application/octet-stream'
    base64Data = `data:${mimeType};base64,${base64}`
  }

  const res = await fetch(base64Data)
  const blob = await res.blob()
  return new File([blob], fileName, { type: blob.type })
}

export const utils = {
  checkEmail,
  generateFileKey,
  getUUID,
  copyText,
  copyRichText,
  formatFileSize,
  utcToReadable,
  getFaviconUrl,
  cleanDeep,
  fileToBase64,
  base64ToFile
}
