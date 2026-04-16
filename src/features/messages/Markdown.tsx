import { Level } from '@/constants'
import { fontSizeAtom, switchToast, themeAtom } from '@/store'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography, { type TypographyProps } from '@mui/material/Typography'
import { logger, utils } from '@utils'
import { useAtom, useAtomValue } from 'jotai'
import React from 'react'
import ReactMarkdown from 'react-markdown'
import { PhotoProvider, PhotoView } from 'react-photo-view'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { a11yDark, atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { visit } from 'unist-util-visit'

import 'katex/dist/katex.min.css'
import { useTranslation } from 'react-i18next'
import 'react-photo-view/dist/react-photo-view.css'

interface MarkdownProps {
  children: string
  hiddenCodeCopyButton?: boolean
  isThinking?: boolean
  allowedVideoNonces?: string[]
}

// 仅允许 video/source/track 以及必要属性
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'video', 'source', 'track'],
  attributes: {
    ...defaultSchema.attributes,
    video: [
      ...(defaultSchema.attributes?.video || []),
      'src',
      'poster',
      'controls',
      'autoPlay',
      'muted',
      'loop',
      'playsInline',
      'dataProgress',
      'dataAspectRatio',
      'dataMdAllow'
    ],
    source: [...(defaultSchema.attributes?.source || []), 'src', 'type'],
    track: [
      ...(defaultSchema.attributes?.track || []),
      'src',
      'kind',
      'srclang',
      'label',
      'default'
    ]
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ['http', 'https', 'data', 'blob']
  }
}

export const Markdown = ({
  children,
  hiddenCodeCopyButton = false,
  isThinking = false,
  allowedVideoNonces = []
}: MarkdownProps) => {
  const [theme] = useAtom(themeAtom)
  const globalFontSize = useAtomValue(fontSizeAtom)
  const fontSize = isThinking ? 14 : globalFontSize

  const rehypeKatexOptions = {
    throwOnError: false,
    errorColor: '#cc0000',
    strict: false,
    trust: true,
    macros: {
      '\\RR': '\\mathbb{R}'
    }
  }

  return (
    <ReactMarkdown
      remarkPlugins={[
        [remarkAllowSpecificVideo, { nonces: allowedVideoNonces }],
        remarkGfm,
        remarkMath,
        remarkBreaks
      ]}
      rehypePlugins={[
        rehypeRaw,
        [rehypeSanitize, sanitizeSchema],
        [rehypeKatex, rehypeKatexOptions]
      ]}
      components={{
        code: ({ className, children, ...props }) => {
          return (
            <CodeBlock
              className={className || ''}
              hiddenCodeCopyButton={hiddenCodeCopyButton}
              children={children}
              fontSize={fontSize}
              {...props}
            />
          )
        },
        ...['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].reduce(
          (acc, tag) => ({
            ...acc,
            [tag]: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => {
              const tagMap = {
                p: 'body1',
                h1: 'h1',
                h2: 'h2',
                h3: 'h3',
                h4: 'h4',
                h5: 'h5',
                h6: 'h6',
                li: 'body1'
              }
              return (
                <Typography
                  variant={tagMap[tag as keyof typeof tagMap] as TypographyProps['variant']}
                  component={tag === 'li' ? 'span' : 'div'}
                  {...props}
                  sx={{
                    color: isThinking ? theme.palette.text.secondary : theme.palette.text.primary
                  }}
                >
                  {children}
                </Typography>
              )
            }
          }),
          {}
        ),
        a: ({ children, href }) => {
          return (
            <Link href={href} underline="always" target="_blank" rel="noreferrer">
              {children}
            </Link>
          )
        },
        img: ({ node, ...props }) => {
          return (
            <PhotoProvider>
              <PhotoView src={props.src}>
                <div className="img-parent">
                  <img className="img-perfect-fit" src={props.src} alt={props.alt} />
                </div>
              </PhotoView>
            </PhotoProvider>
          )
        },
        video: ({ node, ...props }) => {
          let { src, autoPlay = false, controls = false, loop = false, muted = true } = props
          const rawProgress =
            (node?.properties as any)?.dataProgress ?? (node?.properties as any)?.['data-progress']
          const dataProgress = parseFloat(rawProgress) || 0
          const rawAspectRatio =
            (node?.properties as any)?.dataAspectRatio ??
            (node?.properties as any)?.['data-aspect-ratio']

          return (
            <div
              className="video-parent"
              style={{
                aspectRatio: rawAspectRatio || '9/16'
              }}
            >
              {dataProgress < 100 && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--grey-50, #fafafa)',
                    zIndex: 10,
                    pointerEvents: 'none'
                  }}
                >
                  <CircularProgress
                    enableTrackSlot
                    variant={dataProgress > 0 ? 'determinate' : 'indeterminate'}
                    value={dataProgress}
                    size={50}
                    sx={{
                      pointerEvents: 'auto',
                      color: 'var(--text-secondary)'
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ color: 'var(--text-secondary)' }}
                    >{`${Math.round(dataProgress)}%`}</Typography>
                  </Box>
                </Box>
              )}
              <video
                autoPlay={autoPlay}
                controls={controls}
                muted={muted}
                loop={loop}
                className="video-perfect-fit"
                onMouseEnter={(e) => {
                  const video = e.currentTarget
                  video.muted = false
                }}
                onMouseLeave={(e) => {
                  const video = e.currentTarget
                  video.muted = true
                }}
              >
                <source src={src} type="video/mp4" />
                <source src={src} type="video/webm" />
                Your browser does not support the video tag.
              </video>
            </div>
          )
        }
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

interface CodeBlockProps {
  children?: React.ReactNode
  fontSize: number
  className: string
  hiddenCodeCopyButton: boolean
}

function CodeBlock({ children = [], className, hiddenCodeCopyButton, fontSize }: CodeBlockProps) {
  const { t } = useTranslation()
  const [theme] = useAtom(themeAtom)
  const match = /language-(\w+)/.exec(className || '')
  const language = match?.[1] || 'text'
  // 解析文件名
  const fileNameMatch = /language-\w+\s+(.+)/.exec(className || '')
  const fileName = fileNameMatch?.[1]

  if (language === 'text') {
    return (
      <code
        className={className}
        style={{
          color: theme.palette.text.secondary,
          fontSize: `${fontSize}px`,
          margin: '0 6px',
          fontWeight: 'bold',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          overflowWrap: 'break-word'
        }}
      >
        {`${children}`}
      </code>
    )
  }

  return (
    <div
      style={{
        width: '95%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch'
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{
          backgroundColor: 'rgb(50, 50, 50)',
          borderTopLeftRadius: 'var(--radius-sm)',
          borderTopRightRadius: 'var(--radius-sm)',
          px: 'var(--spacing-xs)'
        }}
      >
        <Typography
          variant="overline"
          style={{
            color: '#fff',
            fontSize: `${fontSize}px`
          }}
        >
          {fileName ? `${fileName} (${language})` : `<${language}>`}
        </Typography>
        {!hiddenCodeCopyButton && (
          <ContentCopyIcon
            sx={{
              textDecoration: 'none',
              color: '#fff',
              cursor: 'pointer',
              p: '.14rem'
            }}
            onClick={async () => {
              const success = await utils.copyText(String(children))

              switchToast({
                visible: true,
                message: success ? t('copySuccess') : t('copyFailed'),
                level: success ? Level.success : Level.error
              })
            }}
          />
        )}
      </Stack>

      <div
        style={{
          overflowX: 'auto'
        }}
        className="swiper-no-swiping"
      >
        <SyntaxHighlighter
          style={theme.palette.mode === 'dark' ? atomDark : a11yDark}
          language={language}
          PreTag="div"
          wrapLines={true}
          wrapLongLines={true}
          customStyle={{
            margin: '0',
            boxSizing: 'border-box',
            borderTopLeftRadius: '0',
            borderTopRightRadius: '0',
            borderBottomLeftRadius: 'var(--radius-sm)',
            borderBottomRightRadius: 'var(--radius-sm)',
            border: 'none',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            overflowWrap: 'break-word'
          }}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}

type AllowVideoOptions = { nonces?: string[] }

const DATA_PROGRESS_PRESENT_RE = /\bdata-progress\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)\b/i

// 只放行带有 data-md-allow=nonce 的 <video>，其它所有 HTML 统统当作文本
function remarkAllowSpecificVideo(options: AllowVideoOptions = {}) {
  const { nonces = [] } = options

  return function transformer(tree: any) {
    if (!tree || typeof tree !== 'object' || !('type' in tree)) return

    try {
      visit(tree, 'html', (node, index, parent) => {
        const raw = String(node?.value ?? '')

        // 非 <video>：直接转为纯文本
        if (!/<\s*video\b/i.test(raw)) {
          if (parent && Array.isArray(parent.children) && typeof index === 'number') {
            parent.children[index] = { type: 'text', value: raw }
          }
          return
        }

        // 匹配 data-md-allow 的 nonce
        const m = raw.match(/\bdata-md-allow=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)
        const nonce = m?.[1] || m?.[2] || m?.[3]
        const nonceAllowed = Boolean(nonce && nonces.includes(nonce))

        // 兼容历史：只要存在 data-progress 属性就放行
        const hasLegacyProgress = DATA_PROGRESS_PRESENT_RE.test(raw)
        const allowed = nonceAllowed || hasLegacyProgress

        if (!allowed && parent && Array.isArray(parent.children) && typeof index === 'number') {
          parent.children[index] = { type: 'text', value: raw }
        }
      })
    } catch {
      logger?.warn?.('remarkAllowSpecificVideo failed to parse markdown.')
    }
  }
}
