const paths = {
  login: '/login',
  home: '/'
}
const apiPaths = {
  model: '/model',
  select: '/select',
  topics: '/topics',
  conversations: '/topics/conversations',
  messages: '/topics/messages'
}

const supportImageTypes = [
  'image/jpeg', // JPEG images
  'image/png', // PNG images
  'image/gif', // GIF images
  'image/bmp', // BMP images
  'image/webp', // WebP images
  'image/svg+xml', // SVG images
  'image/tiff', // TIFF images
  'image/x-icon', // ICO images
  'image/heif', // HEIF images
  'image/heic', // HEIC images
  'image/avif' // AVIF images
]

const subscriptionLevelMap = ['Free', 'Light', 'Pro', 'Business', 'Enterprise']

const s3Config = {
  aws_user_files_s3_bucket: process.env.REACT_APP_AWS_USER_FILES_S3_BUCKET,
  aws_user_files_s3_bucket_region: process.env.REACT_APP_API_REGION
}

export const BIZ_URL = 'https://biz.candyhouse.co' // 订阅跳转链接
export const MAX_FILE_SIZE = 9 * 1024 * 1024 // 9MB in bytes
export const PREVIEW_IMG_CLASS = 'user-upload-img' // 可预览图片的类名

export const config = {
  apiPaths,
  paths,
  s3Config,
  defaultLanguage: 'ja',
  supportImageTypes,
  subscriptionLevelMap
}
