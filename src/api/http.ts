import { logger } from '@utils'
import { getIdToken } from './session'

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'

interface ApiOptions {
  params?: Record<string, unknown>
  retry?: number
  requireAuth?: boolean
}

export interface ApiResponse<T = unknown> {
  data: T
  code: number
  message: string
  success: boolean
}

const API_ENDPOINT = process.env.REACT_APP_API_ENDPOINT as string
const TIMEOUT_MS = 30000

function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return ''
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      usp.append(key, String(value))
    }
  }
  const qs = usp.toString()
  return qs ? `?${qs}` : ''
}

// 核心请求函数
async function request<T = unknown>(
  method: Method,
  path: string,
  data?: unknown,
  options?: ApiOptions
): Promise<ApiResponse<T>> {
  const { params, retry = 0, requireAuth = true } = options || {}
  const url = `${API_ENDPOINT}${path}${buildQueryString(params)}`
  const hasBody = method !== 'get' && data !== undefined

  let lastError: unknown

  // 重试逻辑
  for (let i = 0; i <= retry; i++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const headers: Record<string, string> = {}
      if (requireAuth) {
        const idToken = await getIdToken()
        if (!idToken) {
          throw new Error('Not authenticated')
        }
        headers['Authorization'] = idToken
      }
      if (hasBody) headers['Content-Type'] = 'application/json'

      const res = await fetch(url, {
        method: method.toUpperCase(),
        headers,
        ...(hasBody ? { body: JSON.stringify(data) } : {}),
        signal: controller.signal
      })

      // fetch 不会因 4xx/5xx reject，需要显式判断（authorizer 401/403 返回 {message}）
      if (!res.ok) {
        const text = await res.text()
        let message = text
        try {
          message = JSON.parse(text)?.message ?? text
        } catch {
          // 非 JSON 响应体，原样使用
        }
        throw new Error(message || `API error: ${path} (${res.status})`)
      }

      // 统一处理响应
      const response = (await res.json()) as ApiResponse<T>

      if (response?.code && response.code !== 200) {
        throw new Error(response.message || `API error: ${path}`)
      }

      return response
    } catch (error) {
      lastError = error

      // 如果不是最后一次重试，继续
      if (i < retry) {
        await new Promise((r) => setTimeout(r, 1000))
        continue
      }
    } finally {
      clearTimeout(timer)
    }
  }

  // 所有重试都失败了
  logger.error(`API ${method.toUpperCase()} ${path}:`, lastError)
  throw lastError
}

export const api = {
  get: <T = unknown>(
    path: string,
    params?: Record<string, unknown>,
    options: Omit<ApiOptions, 'params'> = {}
  ) => request<T>('get', path, undefined, { ...options, params }),

  post: <T = unknown>(path: string, data?: unknown, options?: ApiOptions) =>
    request<T>('post', path, data, options),

  put: <T = unknown>(path: string, data?: unknown, options?: ApiOptions) =>
    request<T>('put', path, data, options),

  patch: <T = unknown>(path: string, data?: unknown, options?: ApiOptions) =>
    request<T>('patch', path, data, options),

  delete: <T = unknown>(path: string, data?: unknown, options?: ApiOptions) =>
    request<T>('delete', path, data, options)
}
