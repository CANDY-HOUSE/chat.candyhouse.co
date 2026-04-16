import { db, utils } from '@utils'
import Quill from 'quill'
import { BlockEmbed } from 'quill/blots/block'

export interface QuillFileInsert {
  quillFile?: {
    file: string
    name: string
    type: string
    htmlStr: string
  }
  image?: string
}

type QuillFileType = NonNullable<QuillFileInsert['quillFile']>

function createElementFromHTML(htmlString: string) {
  const template = document.createElement('template')
  template.innerHTML = htmlString.trim()
  return template.content.firstChild
}

class FileBlot extends BlockEmbed {
  static blotName = 'quillFile'
  static tagName = 'div'
  static className = 'quill-file-blot'

  static create(value: unknown) {
    const node = super.create() as HTMLElement

    // 如果传入的是 File 对象
    if (value instanceof File) {
      node.setAttribute('contenteditable', 'false')

      // 异步处理文件
      this.processFile(value, node)
    } else if (value && typeof value === 'object') {
      this.assembleNode(node, value as QuillFileType)
    }

    return node
  }

  static async processFile(file: File, node: HTMLElement) {
    try {
      const isImg = file.type.startsWith('image/')
      const fileName = file.name
      const fileSize = utils.formatFileSize(file.size)
      const fileType = isImg ? 'image' : 'file'
      const fileExtension = (fileName.split('.').pop() || '').charAt(0).toLocaleUpperCase()
      const imgSrc = isImg ? URL.createObjectURL(file) : ''

      // 保存文件到本地
      const fileKey = utils.generateFileKey(fileType)
      const fileString = await utils.fileToBase64(file)
      await db.set(fileKey, {
        value: fileString,
        name: fileName,
        uploadTime: Date.now()
      })

      const htmlStrMap = {
        image: `<img class="img-container" src="${imgSrc}" />`,
        file: `
          <div class="file-container">
            <div class="file-extension">
              <div class="file-extension__inner">${fileExtension}</div>
            </div>
            <div class="file-info">
              <div class="file-info__name">${fileName}</div>
              <div class="file-info__size">${fileSize}</div>
            </div>
          </div>
        `
      }
      const htmlString = htmlStrMap[fileType]

      this.assembleNode(node, {
        file: fileKey,
        type: fileType,
        name: fileName,
        htmlStr: htmlString
      })
    } catch {
      node.innerHTML = '<div class="file-error">Error loading file</div>'
    }
  }

  static value(node: HTMLElement) {
    return {
      file: node.getAttribute('data-file'),
      name: node.getAttribute('data-name'),
      type: node.getAttribute('data-type'),
      htmlStr: node.innerHTML
    }
  }

  static assembleNode(node: HTMLElement, value: QuillFileType) {
    const element = createElementFromHTML(value.htmlStr)

    // 清空占位符并更新节点
    node.innerHTML = ''
    node.setAttribute('data-file', value.file)
    node.setAttribute('data-type', value.type)
    node.setAttribute('data-name', value.name)
    node.setAttribute('contenteditable', 'false')
    if (element) {
      node.appendChild(element)
    }
  }
}

// 注册 blot
if (!Quill.imports['formats/quillFile']) {
  Quill.register('formats/quillFile', FileBlot, true)
}

export default FileBlot
