import { logger } from '@utils'
import { API } from 'aws-amplify'
import axios from 'axios'

const axiosInstance = axios.create({ timeout: 30000 })
API.configure({ customHttpClient: axiosInstance })

// 基础类型定义
type Method = 'get' | 'post' | 'put' | 'patch' | 'del'

interface ApiOptions {
  params?: Record<string, any>
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

  // 构建 URL
  const url = params ? `${path}?${new URLSearchParams(params).toString()}` : path

  // 构建请求配置
  const config = method === 'get' ? {} : { body: data }

  let lastError: unknown

  // 重试逻辑
  for (let i = 0; i <= retry; i++) {
    try {
      const response = (await API[method](
        process.env.REACT_APP_API_NAME as string,
        url,
        config
      )) as ApiResponse<T>

      // 统一处理响应
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
  get: <T = unknown,>(
    path: string,
    params?: Record<string, unknown>,
    options: Omit<ApiOptions, 'params'> = {}
  ) => request<T>('get', path, undefined, { ...options, params }),

  post: <T = unknown,>(path: string, data?: unknown, options?: ApiOptions) =>
    request<T>('post', path, data, options),

  put: <T = unknown,>(path: string, data?: unknown, options?: ApiOptions) =>
    request<T>('put', path, data, options),

  patch: <T = unknown,>(path: string, data?: unknown, options?: ApiOptions) =>
    request<T>('patch', path, data, options),

  delete: <T = unknown,>(path: string, data?: unknown, options?: ApiOptions) =>
    request<T>('del', path, data, options)
}
