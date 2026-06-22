import { logger } from '@utils'
import { del, get, patch, post, put } from 'aws-amplify/api'

// REST 请求体类型（DocumentType | FormData | undefined）
type RestBody = NonNullable<Parameters<typeof post>[0]['options']>['body']

const restOps = { get, post, put, patch, del }

// 基础类型定义
type Method = 'get' | 'post' | 'put' | 'patch' | 'del'

interface ApiOptions {
  params?: Record<string, unknown>
  retry?: number
}

export interface ApiResponse<T = unknown> {
  data: T
  code: number
  message: string
  success: boolean
}

// 核心请求函数
async function request<T = unknown>(
  method: Method,
  path: string,
  data?: unknown,
  options?: ApiOptions
): Promise<ApiResponse<T>> {
  const { params, retry = 0 } = options || {}

  const apiName = process.env.REACT_APP_API_NAME as string

  // 将查询参数统一转换为字符串
  const queryParams = params
    ? Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          acc[key] = String(value)
        }
        return acc
      }, {})
    : undefined

  // 构建请求配置
  const restOptions = {
    timeout: 30000,
    ...(queryParams && Object.keys(queryParams).length > 0 ? { queryParams } : {}),
    ...(method !== 'get' && data !== undefined ? { body: data as RestBody } : {})
  }

  let lastError: unknown

  // 重试逻辑
  for (let i = 0; i <= retry; i++) {
    try {
      const { body } = await restOps[method]({ apiName, path, options: restOptions }).response

      // 统一处理响应
      const response = (await body.json()) as unknown as ApiResponse<T>

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
    request<T>('del', path, data, options)
}
