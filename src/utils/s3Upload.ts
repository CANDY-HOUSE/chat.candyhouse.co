import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity'
import { S3Client } from '@aws-sdk/client-s3'
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity'
import { Upload } from '@aws-sdk/lib-storage'
import { config } from '@config'

interface UploadOptions {
  onProgress?: (progress: { loaded: number; total: number }) => void
  customKey?: string
  maxSize?: number
  validateType?: boolean
}

// 初始化 S3 客户端
const s3Client = new S3Client({
  region: config.s3Config.aws_user_files_s3_bucket_region,
  credentials: fromCognitoIdentityPool({
    client: new CognitoIdentityClient({
      region: config.s3Config.aws_user_files_s3_bucket_region
    }),
    identityPoolId: process.env.REACT_APP_IDENTITY_POOL_ID || ''
  })
})

// MIME 类型映射
const MIME_TYPES: Record<string, string> = {
  // 文本文件
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  json: 'application/json; charset=utf-8',
  // 图片
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  // 文档
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // 音频
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  // 视频
  mp4: 'video/mp4',
  webm: 'video/webm',
  // 压缩文件
  zip: 'application/zip',
  rar: 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed'
}

// 需要添加 charset 的 MIME 类型
const CHARSET_TYPES = new Set([
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'text/xml',
  'text/csv',
  'application/json',
  'application/javascript',
  'application/xml'
])

// 验证文件
const validateFile = (file: File | Blob, options: UploadOptions = {}) => {
  const { maxSize, validateType = true } = options

  // 文件大小验证
  if (maxSize && file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / 1024 / 1024)
    throw new Error(`File size exceeds the limit (max ${maxSizeMB}MB)`)
  }

  // 类型验证
  if (validateType && file.type) {
    if (file.type.startsWith('video/')) {
      // 视频文件默认最大 500MB
      const videoMaxSize = maxSize || 500 * 1024 * 1024
      if (file.size > videoMaxSize) {
        throw new Error(`Video file too large (max ${Math.round(videoMaxSize / 1024 / 1024)}MB)`)
      }

      // 验证视频格式
      const supportedVideoTypes = ['video/mp4', 'video/webm']

      if (!supportedVideoTypes.includes(file.type)) {
        if (file instanceof File) {
          const ext = file.name.toLowerCase().split('.').pop()
          if (ext && !MIME_TYPES[ext]?.startsWith('video/')) {
            throw new Error(`Unsupported video format: ${file.type}`)
          }
        } else {
          throw new Error(`Unsupported video format: ${file.type}`)
        }
      }
    }
  }
}

// 获取内容类型
const getContentType = (file: File | Blob): string => {
  if (file.type) {
    return CHARSET_TYPES.has(file.type) ? `${file.type}; charset=utf-8` : file.type
  }

  if (file instanceof File) {
    const ext = file.name.toLowerCase().split('.').pop() || ''
    return MIME_TYPES[ext] || 'application/octet-stream'
  }

  return 'application/octet-stream'
}

// 生成文件键
const generateFileKey = (file: File | Blob, customKey?: string): string => {
  if (customKey) return customKey

  const timestamp = Date.now()

  if (file instanceof File) {
    // 根据文件类型确定目录
    let directory = 'uploads'
    if (file.type.startsWith('video/')) {
      directory = 'videos'
    } else if (file.type.startsWith('image/')) {
      directory = 'images'
    } else if (file.type.startsWith('audio/')) {
      directory = 'audio'
    }

    let key = `${directory}/${timestamp}-${file.name}`

    // 如果文件没有扩展名，添加一个
    if (!file.name.includes('.')) {
      const typeMap: Record<string, string> = {
        'video/': 'mp4',
        'image/': 'jpg',
        'audio/': 'mp3'
      }

      for (const [prefix, ext] of Object.entries(typeMap)) {
        if (file.type.startsWith(prefix)) {
          key += `.${ext}`
          break
        }
      }
    }

    return key
  }

  // 对于 Blob，根据类型决定路径
  if (file.type?.startsWith('video/')) {
    const ext = file.type.split('/')[1] || 'mp4'
    return `videos/${timestamp}-video.${ext}`
  } else if (file.type?.startsWith('audio/')) {
    return `audio/${timestamp}-audio`
  }

  return `uploads/${timestamp}-file`
}

// 执行上传
const performUpload = async (file: File | Blob, options: UploadOptions = {}): Promise<string> => {
  validateFile(file, options)

  const { onProgress, customKey } = options
  const fileKey = generateFileKey(file, customKey)

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: config.s3Config.aws_user_files_s3_bucket,
      Key: fileKey,
      Body: file,
      ContentType: getContentType(file)
    },
    partSize: file.size > 100 * 1024 * 1024 ? 10 * 1024 * 1024 : 5 * 1024 * 1024, // 对大文件使用分片上传
    queueSize: 4 // 并发上传数
  })

  if (onProgress) {
    upload.on('httpUploadProgress', (progress) => {
      onProgress({
        loaded: progress.loaded || 0,
        total: progress.total || 1
      })
    })
  }

  await upload.done()
  return fileKey
}

export const uploadToS3 = (file: File, options?: UploadOptions): Promise<string> => {
  return performUpload(file, options)
}

// 便捷方法：批量上传
export const uploadMultipleToS3 = async (
  files: File[],
  options?: UploadOptions
): Promise<string[]> => {
  return Promise.all(files.map((file) => uploadToS3(file, options)))
}
