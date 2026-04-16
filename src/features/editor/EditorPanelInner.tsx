import type { EditorHandle } from '@/components/editor'
import Editor from '@/components/editor/Editor'
import { useUnifiedPress } from '@/hooks/useUnifiedPress'
import type { ContentBlock } from '@/types/messagetypes'
import { Box, Button, Stack } from '@mui/material'
import React, { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  embed?: boolean
  contentBlock?: ContentBlock[]
  submitFn?: (contentBlock: ContentBlock[] | null) => void
}

const EditorPanelInner: React.FC<Props> = ({ contentBlock, submitFn, embed = false }) => {
  const { t } = useTranslation()
  const editorRef = useRef<EditorHandle>(null)
  const cancelRef = useRef<HTMLElement>(null)
  const saveRef = useRef<HTMLElement>(null)

  useUnifiedPress(saveRef, () => handleSend(true))

  useUnifiedPress(cancelRef, () => handleSend(false))

  const handleSend = useCallback(
    async (isSend: boolean) => {
      if (!submitFn || !editorRef.current) return
      if (isSend) {
        const data = await editorRef.current.getBlock()
        submitFn(data)
      }
      submitFn(null)
    },
    [submitFn]
  )

  useEffect(() => {
    cancelRef.current = null
    saveRef.current = null
  }, [])

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...(embed && {
          border: '1px solid #ccc',
          borderRadius: '0.5rem'
        })
      }}
    >
      <Editor ref={editorRef} submitFn={handleSend} defaultValue={contentBlock} embed={embed} />

      {embed && (
        <Stack direction="row" justifyContent="flex-end" sx={{ p: 'var(--spacing-sm)' }}>
          <Button
            ref={(element) => {
              cancelRef.current = element
            }}
          >
            {t('cancel')}
          </Button>
          <Button
            ref={(element) => {
              saveRef.current = element
            }}
          >
            {t('save')}
          </Button>
        </Stack>
      )}
    </Box>
  )
}

export default React.memo(EditorPanelInner)
