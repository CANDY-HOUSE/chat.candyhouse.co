import { AiAvatarIcon } from '@/components/AiAvatarIcon'
import { useMediaQueryContext } from '@/context/MediaQueryContext'
import { UserMessage } from '@/features/messages/UserMessage'
import { activeTopicIdAtom, focusMessageAtom, switchDialog, topicsAtom } from '@/store'
import type { IMessageSearch } from '@/types/messagetypes'
import { apiMessagesSearch } from '@api'
import SearchIcon from '@mui/icons-material/Search'
import {
  Box,
  Chip,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { chat, utils } from '@utils'
import { useAtomValue, useSetAtom } from 'jotai'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TopicListRef } from './TopicList'

let prevKeywords = ''

interface Props {
  topicListRef?: TopicListRef | null
}

const SearchInput: React.FC<Props> = ({ topicListRef }) => {
  const { isMobile } = useMediaQueryContext()
  const { t } = useTranslation()
  const activeTopicId = useAtomValue(activeTopicIdAtom)
  const topics = useAtomValue(topicsAtom)
  const setFocusMessage = useSetAtom(focusMessageAtom)

  const [keywords, setKeywords] = useState('')
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState(activeTopicId || '')
  const [messages, setMessages] = useState<IMessageSearch[]>([])

  const handleSearch = async () => {
    if (!keywords.trim() || prevKeywords === keywords || loading) return

    setLoading(true)
    const res = await apiMessagesSearch({
      keywords,
      topicId: selectedTopic
    })
    setMessages(res?.data || [])
    setLoading(false)
    setIsEmpty((res?.data || []).length === 0)
    prevKeywords = keywords
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSearch()
    }
  }

  const handleJumpToMessage = async (message: IMessageSearch) => {
    switchDialog({ visible: false })
    const { topicId, model, conversationId, messageId } = message
    const modelId = model ? `${model}#${conversationId}` : ''
    const createdAt = message.createdAt ? `${message.createdAt}#${messageId}` : ''

    await topicListRef?.selectModel(topicId, modelId, createdAt)
    await topicListRef?.clickTopic(topicId, [modelId], createdAt)
    setFocusMessage({ messageId, conversationId })
  }

  useEffect(() => {
    return () => {
      prevKeywords = ''
      setKeywords('')
      setSelectedTopic('')
      setMessages([])
      setIsEmpty(false)
      setLoading(false)
    }
  }, [])

  return (
    <Box
      sx={{
        width: isMobile ? '20rem' : '40rem',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        borderRadius: 'var(--radius-lg)'
      }}
    >
      <Box
        sx={{
          px: 'var(--spacing-sm)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        <Select
          autoWidth
          displayEmpty
          value={selectedTopic}
          variant="standard"
          renderValue={(value) => {
            const label =
              value === ''
                ? t('allTopics')
                : topics.find((t) => t.id === value)?.name || t('allTopics')

            return (
              <Box sx={{ pr: 'var(--spacing-xs)' }}>
                <Chip label={label} />
              </Box>
            )
          }}
          onChange={(e) => {
            setSelectedTopic(e.target.value)
            prevKeywords = ''
          }}
          sx={{
            '&:before': {
              border: 'none'
            },
            '&:hover:not(.Mui-disabled):before': {
              border: 'none'
            },
            '&:after': {
              border: 'none'
            }
          }}
        >
          <MenuItem value="">{t('allTopics')}</MenuItem>
          {topics.map((topic) => (
            <MenuItem key={topic.id} value={topic.id}>
              {topic.name}
            </MenuItem>
          ))}
        </Select>

        <TextField
          autoFocus
          fullWidth
          placeholder={t('SearchContent')}
          variant="standard"
          margin="normal"
          name="search"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton loading={loading} onClick={handleSearch} edge="end">
                    <SearchIcon
                      sx={{
                        fontSize: 'var(--icon-size)',
                        cursor: 'pointer'
                      }}
                    />
                  </IconButton>
                </InputAdornment>
              ),
              sx: {
                '&:before': {
                  borderBottomColor: 'var(--grey-500)'
                },
                '&:hover:not(.Mui-disabled):before': {
                  borderBottomColor: 'var(--grey-500)'
                },
                '&:after': {
                  borderBottomColor: 'var(--grey-500)'
                }
              }
            },
            htmlInput: {
              sx: {
                py: 'var(--spacing-xs)'
              }
            }
          }}
          onKeyDown={handleKeyDown}
        />
      </Box>

      <Box
        className="global-scrollbar"
        sx={{
          px: 'var(--spacing-sm)',
          maxHeight: '60vh',
          overflowY: 'auto',
          width: '100%',
          flexShrink: '0',
          overflowX: 'hidden'
        }}
        onTouchMove={(e) => {
          e.stopPropagation()
        }}
      >
        {messages.map((message) => (
          <Box
            key={message.messageId}
            sx={{ mt: 'var(--spacing-md)', cursor: 'pointer' }}
            onClick={() => handleJumpToMessage(message)}
          >
            <Stack
              direction="row"
              spacing={2}
              sx={{
                overflow: 'hidden',
                px: 'var(--spacing-md)',
                mb: 'var(--spacing-lg)'
              }}
            >
              <Box sx={{ flex: 'none' }}>
                <AiAvatarIcon role={message.role} model={message.model} />
              </Box>

              <Box
                sx={{
                  overflow: 'hidden',
                  flex: 'auto',
                  pt: 'var(--spacing-xs)'
                }}
              >
                <UserMessage
                  blocks={[chat.createContentBlock(message.rawText)]}
                  markKey={keywords}
                />
                <Typography
                  sx={{
                    color: 'var(--text-secondary)',
                    mt: 'var(--spacing-xs)',
                    fontSize: '12px'
                  }}
                >
                  {`${t('model')}: ${message.model}`} &nbsp;
                  {`${t('time')}: ${utils.utcToReadable(message.createdAt)}`}
                </Typography>
              </Box>
            </Stack>
          </Box>
        ))}

        {isEmpty && (
          <Typography sx={{ textAlign: 'center', color: 'var(--text-secondary)', my: 4 }}>
            {t('noResult')}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

export default React.memo(SearchInput)
