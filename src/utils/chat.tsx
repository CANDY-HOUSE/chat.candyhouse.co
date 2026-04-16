import type { QuillFileInsert } from '@/components/editor/blot/file'
import type { ContentBlock, IConversation, IMessage, RoleType } from '@/types/messagetypes'
import { config, PREVIEW_IMG_CLASS } from '@config'
import { MessageState, type SendType } from '@constants'
import { db, logger, utils } from '@utils'
import type { Op } from 'quill'
import { QuillDeltaToHtmlConverter } from 'quill-delta-to-html'
import ReactDOMServer from 'react-dom/server.browser'

const isURL = (str: string) => {
  const urlPattern = /^(https?:\/\/[^\s$.?#].[^\s]*)$/i
  return urlPattern.test(str)
}

// s3 链接生成工厂
const fileUrlFactory = (key: string) => {
  return `https://${config.s3Config.aws_user_files_s3_bucket}.s3.${config.s3Config.aws_user_files_s3_bucket_region}.amazonaws.com/${key}`
}

// 将 ContentBlock 转成 html 字符串
const blocksToHtml = (blocks?: ContentBlock[]): string => {
  if (!blocks) return ''
  const onlyText = blocks.every((block) => block.type === 'text')
  let text = ''
  const ops = blocks
    .filter((block) => {
      // 如果没有 deltaOp
      if (!block.deltaOp) {
        // 如果非文字内容，则需要转成 deltaOp
        if (!onlyText) {
          switch (block.type) {
            case 'image':
              block.deltaOp = { insert: { image: block.url } }
              break
            case 'text':
              block.deltaOp = { insert: block.content }
              break
          }
        } else {
          text += block.content
        }
      }

      return !!block.deltaOp
    })
    .map((block) => block.deltaOp)

  if (ops.length === 0) return text

  const converter = new QuillDeltaToHtmlConverter(ops)

  // 自定义渲染 blot 组件
  converter.renderCustomWith(({ insert }) => {
    if (insert && insert.type === 'quillFile') {
      const val = insert.value as { htmlStr: string }
      const parser = new DOMParser()
      const doc = parser.parseFromString(val.htmlStr, 'text/html')
      const img = doc.querySelector('img')
      const imgSrc = img ? img.getAttribute('src') : null
      const ImgHtml = insert.value.type === 'image' && imgSrc && (
        <div className={`img-parent file-wrap ${PREVIEW_IMG_CLASS}`}>
          <img className="img-perfect-fit" src={imgSrc} alt="Uploaded content" />
        </div>
      )

      if (ImgHtml) {
        return ReactDOMServer.renderToStaticMarkup(ImgHtml)
      }

      return `<div class="file-wrap">${val.htmlStr}</div>`
    }

    return ''
  })

  const htmlStr = converter.convert()

  return htmlStr
}

const createContentBlock = (
  content: string = '',
  type: ContentBlock['type'] = 'text',
  options?: Partial<Omit<ContentBlock, 'type' | 'content'>>
): ContentBlock => {
  return {
    content,
    type,
    ...options
  }
}

const createImgBlock = async (deltaOp: Op, fileName?: string): Promise<ContentBlock> => {
  fileName = fileName || `image_${Date.now()}.png`

  const type = 'image' as const
  const insert = deltaOp.insert
  const base64 =
    typeof insert === 'object' && insert !== null ? (insert.image as string) : undefined
  const block: ContentBlock = {
    type,
    content: '',
    fileKey: utils.generateFileKey(type),
    deltaOp
  }

  if (base64) {
    if (!isURL(base64)) {
      block.file = await utils.base64ToFile(base64, fileName)
      block.fileName = fileName
    } else {
      block.url = base64
    }
  }

  return block
}

const createFileBlock = async (deltaOp: Op): Promise<ContentBlock> => {
  const insert = deltaOp.insert as unknown as QuillFileInsert
  const fileKey = insert.quillFile!.file
  const name = insert.quillFile!.name
  const type = (insert.quillFile!.type || 'file') as ContentBlock['type']
  const fileObj = await db.get<{ value: string }>(fileKey)
  const file = await utils.base64ToFile(fileObj?.value || '', name)

  return {
    type,
    content: '',
    file,
    fileKey,
    fileName: file.name,
    deltaOp
  }
}

// 导入 json 格式对话
const importJsonFile = () => {
  return new Promise<IMessage[]>((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'

    input.onchange = (event) => {
      const target = event.target as HTMLInputElement
      const files = target.files

      if (files && files.length > 0) {
        const file = files[0]
        const reader = new FileReader()

        reader.onload = (e) => {
          try {
            const jsonData = JSON.parse(e.target?.result as string)

            resolve(jsonData.messages)
          } catch (error) {
            reject(error)
          }
        }

        if (file) {
          reader.readAsText(file)
        } else {
          logger.warn('No file selected or file is empty.')
        }
      } else {
        logger.warn('No file selected or file is empty.')
      }
    }

    input.click()
  })
}

// 导出 json 格式对话
const downloadJsonFile = (data: IConversation) => {
  const _data = { name: data.modelId, messages: data.messages }
  const jsonStr = JSON.stringify(_data, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'chat-history.json'
  a.click()
  URL.revokeObjectURL(url)
}

// 创建模版消息
const createTplMsg = (model: string, role: RoleType, sendType?: SendType): IMessage => ({
  createdAt: new Date().toISOString(),
  role: role,
  content: [],
  model: model,
  clientId: utils.getUUID(),
  state: MessageState.loading,
  words: 0,
  tokens: 0,
  totalTokens: 0,
  ...(sendType && { sendType })
})

// 创建模版会话
const createTplConv = (topicId: string, model: string): IConversation => {
  const conversationId = utils.getUUID()
  const now = new Date().toISOString()

  return {
    topicId: topicId,
    conversationId,
    modelId: `${model}#${conversationId}`,
    createdAt: now,
    updatedAt: now,
    messages: [],
    modelInfo: {
      modelName: model,
      alias: model
    },
    nextToken: null
  }
}

const countContentBlocksChars = (blocks: ContentBlock[]): number => {
  let totalChars = 0

  blocks.forEach((block) => {
    if (block.type === 'text') {
      totalChars += block.content.length
    }
  })

  return totalChars
}

export const chat = {
  fileUrlFactory,
  blocksToHtml,
  importJsonFile,
  downloadJsonFile,

  createContentBlock,
  createImgBlock,
  createFileBlock,
  createTplMsg,
  createTplConv,
  countContentBlocksChars
}
