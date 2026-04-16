import { imagePreviewSrcsAtom } from '@/store'
import type { ContentBlock } from '@/types/messagetypes'
import { PREVIEW_IMG_CLASS } from '@config'
import { Box, Typography } from '@mui/material'
import { styled } from '@mui/material/styles'
import { chat } from '@utils'
import { useSetAtom } from 'jotai'
import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  blocks: ContentBlock[]
  markKey?: string
  className?: string
}
const HighlightedText = styled('mark')(({ theme }) => ({
  backgroundColor: theme.palette.warning.light,
  color: theme.palette.warning.contrastText,
  padding: '0 2px',
  borderRadius: '2px',
  overflowX: 'hidden',
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word'
}))

const CodeBlock = styled('pre')(() => ({
  padding: '10px',
  color: '#fff',
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  width: '100%',
  boxSizing: 'border-box'
}))

export const UserMessage: React.FC<Props> = ({ blocks, markKey, className }) => {
  const { t } = useTranslation()
  const setImagePreviewSrcs = useSetAtom(imagePreviewSrcsAtom)
  const contentRef = useRef<HTMLDivElement>(null)

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const highlightText = (text: string, keyword?: string) => {
    if (!keyword) return text

    const regex = new RegExp(escapeRegExp(keyword), 'gi')
    const highlighted: React.ReactNode[] = []
    let lastIndex = 0
    let matchIndex = 0

    for (const match of text.matchAll(regex)) {
      const start = match.index ?? 0
      if (start > lastIndex) {
        highlighted.push(
          <React.Fragment key={`plain-${matchIndex}-${start}`}>
            {text.slice(lastIndex, start)}
          </React.Fragment>
        )
      }

      highlighted.push(
        <HighlightedText key={`highlight-${matchIndex}-${start}`}>{match[0]}</HighlightedText>
      )

      lastIndex = start + match[0].length
      matchIndex += 1
    }

    if (lastIndex < text.length) {
      highlighted.push(
        <React.Fragment key={`plain-tail-${matchIndex}`}>{text.slice(lastIndex)}</React.Fragment>
      )
    }

    return highlighted
  }

  const extractCode = (text: string, highlightKey: string) => {
    const codeRegex = /```(\w*)\n([\s\S]*?)```/g
    const elements: React.ReactNode[] = []
    let cursor = 0
    let blockIndex = 0

    const pushPlainText = (content: string, keySuffix?: string) => {
      if (!content) return
      elements.push(
        <Typography
          variant="body1"
          key={`text-${keySuffix}`}
          sx={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', maxWidth: '100%' }}
        >
          {highlightText(content, highlightKey)}
        </Typography>
      )
    }

    const pushCodeBlock = (language: string, code: string, keySuffix?: string) => {
      elements.push(
        <Box
          key={`code-${keySuffix}`}
          sx={{
            backgroundColor: '#000',
            borderRadius: '4px',
            ml: '4px',
            mt: '5px',
            overflowY: 'hidden',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            maxWidth: '100%'
          }}
        >
          <Typography variant={'h6'} sx={{ pl: '10px', background: '#666', color: '#fff' }}>
            {language ? `<${language}>` : '<TEXT>'}
          </Typography>
          <CodeBlock>
            <code>{highlightText(code, highlightKey)}</code>
          </CodeBlock>
        </Box>
      )
    }

    for (const match of text.matchAll(codeRegex)) {
      const [fullMatch, language, code] = match
      const start = match.index ?? 0

      if (start > cursor) {
        pushPlainText(text.slice(cursor, start), `${blockIndex}-leading`)
      }

      pushCodeBlock(language!, code!, `${blockIndex}`)
      cursor = start + fullMatch.length
      blockIndex += 1
    }

    if (cursor < text.length) {
      pushPlainText(text.slice(cursor), 'tail')
    }

    return elements
  }

  const renderBlocks = () => {
    const cleanHtml = chat.blocksToHtml(blocks)

    if (markKey) return extractCode(cleanHtml, markKey)

    return (
      <Box
        className="ql-editor"
        sx={{
          padding: 0,
          whiteSpace: 'normal',
          wordWrap: 'break-word',
          wordBreak: 'normal'
        }}
        dangerouslySetInnerHTML={{ __html: cleanHtml }}
      ></Box>
    )
  }

  useEffect(() => {
    // 图片预览点击
    const imgs = document.getElementsByClassName(PREVIEW_IMG_CLASS)
    const handleClick = (e: Event) => {
      const target = e.target as HTMLImageElement
      const src = target.src
      setImagePreviewSrcs([src])
    }
    for (let i = 0; i < imgs.length; i++) {
      imgs[i]?.addEventListener('click', handleClick)
    }

    return () => {
      for (let i = 0; i < imgs.length; i++) {
        imgs[i]?.removeEventListener('click', handleClick)
      }
    }
  }, [])

  if (blocks.length < 1) {
    return <Typography variant="body1">{t('noAvailableInformation')}</Typography>
  }

  return (
    <Box className={className} ref={contentRef}>
      {renderBlocks()}
    </Box>
  )
}
