import type { QuillFileInsert } from '@/components/editor/blot/file'
import type { UnifiedInput } from '@/types/ai'
import type { ContentBlock } from '@/types/messagetypes'
import { chat, uploadToS3 } from '@/utils'
import { SendType } from '@constants'
import { useCallback } from 'react'
import { useConversation } from './useConversation'

export const useMessage = () => {
  const { getConversation } = useConversation()

  // 将统一的消息格式转换为 aiService 的消息格式
  const toAiRequest = useCallback(
    (
      conversationId: string,
      clientId: string,
      sendType: SendType,
      topicId?: string
    ): [UnifiedInput[], string] => {
      const conv = getConversation(conversationId, topicId)!
      const { messages } = conv
      let chatMsgs: UnifiedInput[] = [] // 转换后的消息列表
      let basedId = clientId // 基于哪条用户消息的回答

      for (const msg of messages) {
        const isTheSendingMsg = msg.clientId === clientId // 是否是当前发送的消息
        const ret: UnifiedInput = {
          role: 'user',
          content: []
        }
        ret.role = msg.role as UnifiedInput['role']
        if (msg.cacheControl) ret.cacheControl = true

        // 将 ContentBlock 转换成 UnifiedInput
        for (const { type, content, url, fileName, fileKey } of msg.content!) {
          let c_ret: any = {
            type: 'text',
            text: `Unsupported content type: ${type}`
          }

          switch (type) {
            case 'text':
              c_ret = {
                type: 'text',
                text: content || ''
              }
              break
            case 'image':
              c_ret = {
                type: 'image_url',
                image_url: { url: url || '' },
                file_id: fileKey
              }
              break
            case 'file':
              c_ret = {
                type: 'file',
                file: {
                  file_data: url,
                  filename: fileName,
                  file_id: fileKey
                }
              }
              break
          }

          if (Array.isArray(ret.content)) {
            ret.content.push(c_ret)
          } else {
            ret.content = [c_ret]
          }
        }

        chatMsgs.push(ret)

        if (isTheSendingMsg) {
          if (sendType === SendType.refresh) {
            if (msg.role === 'assistant') {
              const index = chatMsgs.findLastIndex((msg) => msg.role === 'user')
              chatMsgs = chatMsgs.slice(0, index + 1)
              basedId = messages[index]!.clientId
            }
          }
          break
        }
      }

      return [chatMsgs, basedId]
    },
    [getConversation]
  )

  // 上传消息中的文件
  const uploadFiles = useCallback(async (blocks: ContentBlock[]): Promise<ContentBlock[]> => {
    const result: ContentBlock[] = []

    for (const item of blocks) {
      const { fileKey, file, deltaOp, ...rest } = item
      if (['image', 'file'].includes(item.type)) {
        if (file) {
          try {
            const insert = deltaOp?.insert as unknown as QuillFileInsert
            let url = ''

            if (insert) {
              const regex = /<img\b[^>]*?\ssrc=["']([^"']+)["']/i
              const match = insert.quillFile?.htmlStr?.match(regex)

              // 判断是否需要上传图片
              if (match && match[1]) {
                const imgUrl = match[1]

                if (imgUrl.startsWith(chat.fileUrlFactory(''))) {
                  url = imgUrl
                }
              }

              if (!url) {
                url = chat.fileUrlFactory(await uploadToS3(file))

                if (insert.quillFile) {
                  // 插入内容
                  const newHtmlStr = insert.quillFile.htmlStr.replace(
                    /(<img\b[^>]*?\ssrc=["'])[^"']+(["'][^>]*>)/i,
                    `$1${url}$2`
                  )
                  insert.quillFile.htmlStr = newHtmlStr
                } else if (insert.image) {
                  // 复制内容
                  if (deltaOp) {
                    deltaOp.insert = {
                      quillFile: {
                        name: url.split('/').pop()!,
                        htmlStr: `<img class="img-container" src="${url}" />`,
                        file: fileKey,
                        type: 'image'
                      }
                    }
                  }
                }
              }
            }

            result.push({
              ...rest,
              deltaOp,
              url,
              fileKey
            })
          } catch (error) {
            result.push({
              ...rest,
              type: 'error',
              content: error instanceof Error ? error.message : String(error)
            })
          }
        } else {
          if (item.url) {
            result.push(item)
          }
        }
      } else {
        result.push({ ...item })
      }
    }

    return result
  }, [])

  return {
    toAiRequest,
    uploadFiles
  }
}
