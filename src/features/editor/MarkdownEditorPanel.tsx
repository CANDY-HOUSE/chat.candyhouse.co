import { Box, Button, Stack, TextField } from '@mui/material'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  initialText: string
  submitFn: (text: string | null) => void
}

// AI 消息的 content 是 markdown 源文本，没有对应的 Quill Delta 结构，
// 因此编辑时直接编辑源文本，而不经过富文本编辑器（避免语法被解析成字面量、丢失渲染样式）
const MarkdownEditorPanel: React.FC<Props> = ({ initialText, submitFn }) => {
  const { t } = useTranslation()
  const [text, setText] = useState(initialText)

  const handleCancel = useCallback(() => submitFn(null), [submitFn])
  const handleSave = useCallback(() => submitFn(text), [submitFn, text])

  return (
    <Box
      sx={{
        width: '100%',
        border: '1px solid #ccc',
        borderRadius: '0.5rem',
        p: 'var(--spacing-sm)'
      }}
    >
      <TextField
        autoFocus
        fullWidth
        multiline
        minRows={3}
        maxRows={20}
        variant="outlined"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 'var(--spacing-sm)' }}>
        <Button onClick={handleCancel}>{t('common.cancel')}</Button>
        <Button onClick={handleSave}>{t('common.save')}</Button>
      </Stack>
    </Box>
  )
}

export default React.memo(MarkdownEditorPanel)
