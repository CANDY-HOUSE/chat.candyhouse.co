import { switchToast } from '@/store'
import type { ContentBlock } from '@/types/messagetypes'
import { MAX_FILE_SIZE } from '@config'
import { Level } from '@constants'
import { chat, getLocalValue, localKey, logger, putLocalValue } from '@utils'
import Quill, { Delta, type Range } from 'quill'
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import './blot/file'
import Toolbar from './Toolbar'

import 'quill/dist/quill.snow.css'
import './index.scss'

interface Props {
  embed?: boolean
  disableSend?: boolean
  defaultValue?: ContentBlock[]
  submitFn?: (isSend: boolean) => void
  onTextChange?: (delta: Delta, content: Delta) => void
  onSelectionChange?: (range: Range) => void
}
type DraftsType = { content: Delta; updatedAt: string }

export interface EditorHandle {
  getBlock: () => Promise<ContentBlock[]>
  getContent: (format: 'html' | 'delta' | 'text') => string | Delta
  setContent: (content: string | Delta, source: 'api' | 'user', selectAll?: boolean) => void
  focus: () => void
  getQuill: () => Quill | null
  clear: (clearHistory?: boolean) => void
}

type QuillInstance = InstanceType<typeof Quill>

const Editor = forwardRef<EditorHandle, Props>(
  (
    { embed = false, disableSend = false, defaultValue, submitFn, onTextChange, onSelectionChange },
    ref
  ) => {
    const { t } = useTranslation()
    const editorRef = useRef<HTMLDivElement>(null)
    const editorContainerRef = useRef<HTMLDivElement>(null)
    const toolbarContainerRef = useRef<HTMLDivElement>(null)
    const quillRef = useRef<QuillInstance | null>(null)
    const rangeRef = useRef<Range>(null)
    const defaultValueRef = useRef(defaultValue)
    const onTextChangeRef = useRef(onTextChange)
    const onSelectionChangeRef = useRef(onSelectionChange)

    const [isEditorEmpty, setIsEditorEmpty] = useState(true)
    const [isComposing, setIsComposing] = useState(false)

    const disableSendRef = useRef(disableSend)
    const isEditorEmptyRef = useRef(isEditorEmpty)
    const isComposingRef = useRef(isComposing)
    const draftsRef = useRef<DraftsType | null>(getLocalValue(localKey.editorDrafts))
    const editorHistoryIndexRef = useRef(-1)

    // 创建草稿
    const createDraft = useCallback(
      (delta: Delta | null) => {
        if (embed) return
        const data = delta
          ? {
              content: delta,
              updatedAt: new Date().toISOString()
            }
          : null
        draftsRef.current = data
        putLocalValue(localKey.editorDrafts, data)
      },
      [embed]
    )

    // 删除草稿
    const deleteDraft = useCallback(() => {
      if (embed) return
      draftsRef.current = null
      putLocalValue(localKey.editorDrafts, null)
    }, [embed])

    // 将 delta 转换为 block
    const delta2Block = useCallback(async (delta: Delta) => {
      const result: ContentBlock[] = []
      const ops = delta.ops

      for (const op of ops!) {
        if (op.insert) {
          if (typeof op.insert === 'string') {
            // 解析文本
            const block = chat.createContentBlock(op.insert, 'text', { deltaOp: op })
            result.push(block)
          } else if (op.insert.image) {
            // 解析图片
            const block = await chat.createImgBlock(op)
            result.push(block)
          } else if (op.insert.quillFile) {
            // 解析文件
            const block = await chat.createFileBlock(op)
            result.push(block)
          }
        }
      }

      return result
    }, [])

    // 检查 quill 内容是否为空
    const checkIsEmpty = useCallback((delta: Delta): boolean => {
      if (!delta.ops) return true

      return delta.ops.every((op) => {
        if (!op.insert) return true
        if (typeof op.insert === 'string') {
          return op.insert.trim() === ''
        }
        return false
      })
    }, [])

    // 校验文件类型
    const validateFile = useCallback(
      (file: File) => {
        if (file.type.startsWith('video/')) return false
        const fileName = file.name.toLowerCase()
        const unsupportedExtensions = [
          '.exe',
          '.dll',
          '.bat',
          '.cmd',
          '.msi',
          '.app',
          '.sys',
          '.bin',
          '.iso'
        ]

        if (unsupportedExtensions.some((ext) => fileName.endsWith(ext))) {
          switchToast({ visible: true, message: t('fileTypeNotSupported'), level: Level.error })
          return false
        }

        if (file.size > MAX_FILE_SIZE) {
          switchToast({ visible: true, message: t('fileError'), level: Level.error })
          return false
        }

        return true
      },
      [t]
    )

    // 插入文件
    const insertFiles = useCallback((files: File[]) => {
      const quill = quillRef.current
      const range = rangeRef.current
      if (!quill || files.length < 1) return

      files.forEach((file) => {
        const currentIndex = range?.index ?? 0
        quill.insertEmbed(currentIndex, 'quillFile', file)
        const nextIndex = currentIndex + 2
        quill.setSelection(nextIndex, 0)
      })
    }, [])

    // 清除 quill 内容
    const clear = useCallback((clearHistory = false) => {
      if (quillRef.current) {
        quillRef.current.setContents([{ insert: '\n' }])

        // 如果需要，清除历史记录
        if (clearHistory) {
          const history = quillRef.current.getModule('history') as { clear?: () => void }
          history?.clear?.()
        }

        setIsEditorEmpty(true)
      }
    }, [])

    // 获取 quill 内容
    const getContent = useCallback((format: 'html' | 'delta' | 'text' = 'html') => {
      if (!quillRef.current) return ''

      switch (format) {
        case 'delta':
          return quillRef.current.getContents()
        case 'text':
          return quillRef.current.getText()
        case 'html':
        default:
          return quillRef.current.root.innerHTML
      }
    }, [])

    // 获取编辑器 block 内容
    const getBlock = useCallback(async () => {
      const delta = getContent('delta')
      return await delta2Block(delta as Delta)
    }, [delta2Block, getContent])

    // 设置 quill 内容
    const setContent = useCallback(
      (content: string | Delta, source: 'api' | 'user' = 'api', selectAll = false) => {
        if (!quillRef.current) return

        if (typeof content === 'string') {
          // HTML 字符串
          const delta = quillRef.current.clipboard.convert({ html: content })
          quillRef.current.setContents(delta, source)
        } else {
          // Delta 对象
          quillRef.current.setContents(content, source)
        }

        const length = quillRef.current.getLength()

        if (selectAll) {
          // 选中所有内容
          quillRef.current.setSelection(0, length - 1)
        } else {
          // 将光标定位到插入内容的末尾
          quillRef.current.setSelection(length - 1, 0)
        }
      },
      []
    )

    // 点击发送按钮
    const handleSubmit = useCallback(() => {
      // 存储消息历史
      let editorHistory = getLocalValue<Array<Delta | string>>(localKey.editorHistory) || []
      editorHistory = editorHistory.slice(-10)
      const delta = getContent('delta')
      editorHistory.unshift(delta)
      putLocalValue(localKey.editorHistory, editorHistory)
      editorHistoryIndexRef.current = -1

      submitFn?.(true)
      clear()
      deleteDraft()
    }, [clear, deleteDraft, getContent, submitFn])

    // 删除选区
    const deleteRange = () => {
      const selection = window.getSelection()
      if (!selection || !selection.rangeCount) return

      const range = selection.getRangeAt(0)
      if (!range.collapsed) {
        range.deleteContents()
      }
    }

    // 处理粘贴或拖拽事件
    const handlePasteOrDrop = useCallback(
      async (e: ClipboardEvent | DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()

        deleteRange()

        try {
          const dataTransfer =
            e.type === 'paste' ? (e as ClipboardEvent).clipboardData : (e as DragEvent).dataTransfer

          if (dataTransfer) {
            const htmlData = dataTransfer.getData('text/html') // 获取 HTML 内容
            const plainText = dataTransfer.getData('text/plain') // 获取纯文本
            const items = dataTransfer.items // 获取粘贴的数据项
            const files: File[] = []

            for (const item of items) {
              if (item.kind === 'file') {
                const file = item.getAsFile()
                if (file) {
                  if (!validateFile(file)) return
                  files.push(file)
                }
              }
            }

            // 解析 HTML
            let html = htmlData || plainText
            if (html) {
              // 如果是 editor 数据
              const editorValuePrefix = '$$delta '
              if (html.startsWith(editorValuePrefix)) {
                const data: ContentBlock[] = JSON.parse(html.slice(editorValuePrefix.length))
                const delta = data.map((item) => item.deltaOp) as unknown as Delta
                setContent(delta)
                return
              }

              const parser = new DOMParser()
              const doc = parser.parseFromString(html, 'text/html')
              let parsedHtml = doc.body.innerHTML
              quillRef.current?.clipboard.dangerouslyPasteHTML(
                rangeRef.current?.index ?? 0,
                parsedHtml
              )
            }

            insertFiles(files)
          }
        } catch (error) {
          logger.error(error)
        }
      },
      [insertFiles, setContent, validateFile]
    )

    // 处理键盘按下事件
    const handleKeydown = useCallback((event: KeyboardEvent) => {
      const key = event.key
      const quill = quillRef.current!
      event.stopPropagation()

      const selection = quill.getSelection()

      // 检查是否选中了所有内容
      const isAllSelected = () => {
        if (!selection) return false
        const contentLength = quill.getLength()
        return selection.index === 0 && selection.length === contentLength - 1
      }

      if (!isAllSelected) editorHistoryIndexRef.current = -1

      switch (key) {
        case 'ArrowUp':
        case 'ArrowDown':
          // 历史消息选择
          if (isAllSelected()) {
            event.preventDefault()
            const editorHistory = getLocalValue<Array<Delta | string>>(localKey.editorHistory) || []
            let index = editorHistoryIndexRef.current

            if (key === 'ArrowUp') {
              index += 1
            } else {
              index -= 1
            }
            if (index < 0 || index > editorHistory.length - 1) return

            editorHistoryIndexRef.current = index
            const value = editorHistory[index] || ''
            setContent(value, 'user', true)
          }
          break

        case 'Backspace':
        case 'Delete':
          // 检查是否需要删除当前元素
          const selection = quill.getSelection()
          if (selection && selection.index === 0 && selection.length === 0) {
            const [blot] = quill.getLeaf(selection.index)

            // 如果光标在块级元素的开始位置
            if (blot && blot.parent) {
              const parentBlot = blot.parent

              if (
                parentBlot.statics.blotName === 'list-item' ||
                parentBlot.statics.blotName === 'block-quote' ||
                parentBlot.statics.blotName === 'code-block'
              ) {
                // 检查当前块是否为空
                if (parentBlot.length() <= 1) {
                  event.preventDefault()

                  // 移除格式，转换为普通段落
                  const formats = quill.getFormat(selection)
                  Object.keys(formats).forEach((format) => {
                    if (format === 'list' || format === 'blockquote' || format === 'code-block') {
                      quill.format(format, false, 'user')
                    }
                  })
                }
              }
            }
          }
          break
      }
    }, [])

    const handleComposition = useCallback((event: CompositionEvent) => {
      const value = event.type === 'compositionstart'
      setIsComposing(value)
    }, [])

    useImperativeHandle(ref, () => ({
      getBlock,
      getContent,
      setContent,
      focus: () => {
        if (quillRef.current) {
          quillRef.current.focus()
        }
      },
      getQuill: () => quillRef.current,
      clear: clear
    }))

    useLayoutEffect(() => {
      onTextChangeRef.current = onTextChange
      onSelectionChangeRef.current = onSelectionChange
    })

    useEffect(() => {
      disableSendRef.current = disableSend
    }, [disableSend])

    useEffect(() => {
      isEditorEmptyRef.current = isEditorEmpty
    }, [isEditorEmpty])

    useEffect(() => {
      isComposingRef.current = isComposing
    }, [isComposing])

    useEffect(() => {
      if (!editorContainerRef.current || !toolbarContainerRef.current) {
        return
      }

      // 确保容器是空的
      editorContainerRef.current.innerHTML = ''

      try {
        // 初始化 quill
        const quill = new Quill(editorContainerRef.current, {
          theme: 'snow',
          placeholder: 'Please enter',
          modules: {
            toolbar: {
              container: toolbarContainerRef.current,
              handlers: {
                sendMsg() {
                  handleSubmitRef.current()
                },
                list: (value: unknown) => {
                  let range = quill.getSelection()
                  if (!range) {
                    quill.focus()
                    range = quill.getSelection(true)
                  }

                  if (range) {
                    const formats = quill.getFormat(range)
                    const currentList = formats.list

                    if (currentList === value) {
                      quill.format('list', false, 'user')
                    } else {
                      quill.format('list', value, 'user')
                    }
                  }
                }
              }
            },
            keyboard: {
              bindings: {
                link: null,
                enter: {
                  key: 'Enter',
                  handler(range: Range, context: unknown) {
                    // 检查是否按下了Shift键
                    if (typeof context === 'object' && context !== null && 'shifted' in context) {
                      quill.insertText(range.index, '\n', 'user')
                      quill.setSelection(range.index + 1, 0)
                      return false
                    }
                    if (!isEditorEmptyRef.current && !disableSendRef.current) {
                      handleSubmitRef.current()
                    }

                    return false
                  }
                }
              }
            }
          }
        })

        quillRef.current = quill

        // 初始化 quill 内容
        if (defaultValueRef.current) {
          const delta = defaultValueRef.current.map((item) => {
            if (item.deltaOp) {
              return item.deltaOp
            }

            switch (item.type) {
              case 'image':
                return {
                  insert: {
                    image: item.url || item.content
                  }
                }

              case 'file':
                return {
                  insert: `📎 ${item.fileName || 'File'}`,
                  attributes: {
                    link: item.url || item.content
                  }
                }

              case 'text':
              default:
                return {
                  insert: item.content
                }
            }
          })

          defaultValueRef.current && quill.setContents(delta)
        }

        // 绑定事件
        quill.on('editor-change', (eventName, ...args) => {
          if (eventName === 'text-change') {
            const currentContent = quill.getContents()
            const isEmpty = checkIsEmpty(currentContent)
            setIsEditorEmpty(isEmpty)

            createDraftRef.current(isEmpty ? null : currentContent) // 创建草稿
            onTextChangeRef.current?.(args[0] as Delta, currentContent)
          } else if (eventName === 'selection-change') {
            rangeRef.current = args[0] as Range
            onSelectionChangeRef.current?.(args[0] as Range)
          }
        })

        quill.root.addEventListener('keydown', handleKeydown)
        quill.root.addEventListener('paste', handlePasteOrDrop, { capture: true })
        quill.root.addEventListener('drop', handlePasteOrDrop, { capture: true })
        quill.root.addEventListener('compositionstart', handleComposition)
        quill.root.addEventListener('compositionend', handleComposition)

        // 禁用 Quill 的拖放处理
        quill.root.addEventListener(
          'dragover',
          (e) => {
            e.preventDefault()
            e.dataTransfer!.dropEffect = 'copy'
          },
          { capture: true }
        )

        // 禁用第三方语法检查
        quill.root.setAttribute('data-gramm', 'false')
        quill.root.setAttribute('inputmode', 'text')
        quill.root.setAttribute('enterkeyhint', 'send')
        quill.root.setAttribute('autocapitalize', 'sentences')

        // 加载草稿箱
        if (!defaultValueRef.current && draftsRef.current?.content) {
          quillRef.current.setContents(draftsRef.current?.content)
        }
      } catch (error) {
        logger.error('Failed to initialize Quill:', error)
      }

      const editorContainer = editorContainerRef.current

      return () => {
        if (quillRef.current) {
          quillRef.current.off('editor-change')
          quillRef.current.root.removeEventListener('keydown', handleKeydown)
          quillRef.current.root.removeEventListener('paste', handlePasteOrDrop, { capture: true })
          quillRef.current.root.removeEventListener('drop', handlePasteOrDrop, { capture: true })
          quillRef.current.root.removeEventListener('compositionstart', handleComposition)
          quillRef.current.root.removeEventListener('compositionend', handleComposition)

          if (editorContainer) {
            editorContainer.innerHTML = ''
          }

          quillRef.current = null
        }
      }
    }, [])

    const handleSubmitRef = useRef(handleSubmit)
    handleSubmitRef.current = handleSubmit
    const createDraftRef = useRef(createDraft)
    createDraftRef.current = createDraft

    return (
      <div ref={editorRef} className="editor-container">
        <Toolbar
          ref={toolbarContainerRef}
          fileFn={insertFiles}
          validateFile={validateFile}
          disableSend={isEditorEmpty || disableSend}
          embed={embed}
          style={{
            borderTop: 'none'
          }}
        />
        <div
          id="editor"
          ref={editorContainerRef}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
            e.currentTarget.classList.add('drag-over')
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            e.stopPropagation()
            e.currentTarget.classList.remove('drag-over')
          }}
        ></div>
      </div>
    )
  }
)

Editor.displayName = 'Editor'

export default React.memo(Editor)
