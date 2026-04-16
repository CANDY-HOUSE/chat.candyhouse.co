import { useConversation } from '@/hooks/useConversation'
import { useModel } from '@/hooks/useModel'
import { switchDialog, switchToast } from '@/store'
import { Level } from '@constants'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import { useTheme } from '@mui/material/styles'
import TextField from '@mui/material/TextField'
import { chat, enhanceEventParams } from '@utils'
import JSON5 from 'json5'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  conversationId: string
  changeCache: (data: Record<string, unknown>) => void
}

const customStyle = {
  container: {
    width: 'max(20rem, 60vw)',
    p: 'var(--spacing-md)'
  }
}

const ModelSettingDialog: React.FC<Props> = ({ changeCache, conversationId }) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const { getModelName } = useModel()
  const { getAttrValue, pushMessage, getConversation } = useConversation()
  const modelInfo = getAttrValue(conversationId, 'modelInfo')!
  const modelName = getModelName(modelInfo.modelName)
  const conversation = getConversation(conversationId)
  let jsonConfig = modelInfo.jsonConfig
  let jsonConfigRaw = modelInfo.jsonConfigRaw

  // JSON 校验状态
  const [jsonError, setJsonError] = useState<string>('')
  const [jsonRawValue, setJsonRawValue] = useState<string>(
    jsonConfigRaw || (jsonConfig ? JSON.stringify(jsonConfig, null, 2) : '')
  )

  const handleJsonChange = (value: string) => {
    setJsonRawValue(value)

    // 如果输入为空，清除错误并重置值
    if (!value.trim()) {
      setJsonError('')
      changeCache({ jsonConfig: undefined, jsonConfigRaw: undefined })
      return
    }

    // 解析 JSON
    try {
      const parsedValue = JSON5.parse(value)

      // 检查解析后的值必须是对象
      if (typeof parsedValue !== 'object' || parsedValue === null || Array.isArray(parsedValue)) {
        setJsonError(t('modelSetting.typeError'))
        return
      }

      setJsonError('')
      changeCache({ jsonConfig: parsedValue, jsonConfigRaw: value })

      gtag(
        'event',
        'model_setting',
        enhanceEventParams({
          setting_type: 'jsonConfig',
          model_name: modelName
        })
      )
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Invalid JSON format')
    }
  }

  const handleJsonKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 当按下 Tab 键时，插入缩进而不是切换焦点
    if (e.key === 'Tab') {
      e.preventDefault()

      const target = e.target as HTMLTextAreaElement
      const start = target.selectionStart
      const end = target.selectionEnd
      const value = target.value

      // 插入两个空格作为缩进
      const newValue = value.substring(0, start) + '  ' + value.substring(end)

      // 更新值
      handleJsonChange(newValue)

      // 设置光标位置
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2
      }, 0)
    }
  }

  const handleImport = () => {
    chat
      .importJsonFile()
      .then((messages) => {
        messages.forEach((message) => {
          pushMessage(conversationId, message)
        })

        switchDialog({ visible: false })
      })
      .catch(() => {
        switchToast({ visible: true, message: t('ImportFailed'), level: Level.error })
      })

    gtag(
      'event',
      'model_management',
      enhanceEventParams({
        action_type: 'import',
        model_name: modelName
      })
    )
  }

  const handleExport = () => {
    if (!conversation) return
    chat.downloadJsonFile(conversation)

    gtag(
      'event',
      'model_management',
      enhanceEventParams({
        action_type: 'export',
        model_name: modelName
      })
    )
  }

  return (
    <Stack direction="column" spacing={2} sx={customStyle.container}>
      <Box
        sx={{
          width: '100%',
          flex: 'auto',
          maxHeight: '60vh',
          overflow: 'hidden'
        }}
      >
        {/* JSON 配置 */}
        <TextField
          fullWidth
          multiline
          minRows={8}
          variant="outlined"
          value={jsonRawValue}
          label={t('modelSetting.jsonConfig')}
          placeholder={'{\n  key: "value",\n}'}
          error={!!jsonError}
          helperText={jsonError || ' '}
          slotProps={{
            inputLabel: { shrink: true },
            formHelperText: { sx: { fontSize: '0.65rem' } },
            htmlInput: {
              sx: {
                overflow: 'auto!important',
                whiteSpace: 'nowrap',
                wordWrap: 'normal',
                fontFamily: 'monospace'
              }
            }
          }}
          sx={{
            mt: 'var(--spacing-md)'
          }}
          onChange={(e) => handleJsonChange(e.target.value)}
          onKeyDown={handleJsonKeyDown}
        />
      </Box>

      <Box
        sx={{
          width: '100%',
          flex: 'none',
          display: 'flex',
          justifyContent: 'flex-end',
          columnGap: 2
        }}
      >
        {conversationId && (
          <Button
            startIcon={<FileUploadIcon />}
            onClick={handleImport}
            variant="outlined"
            size="small"
            sx={{
              textTransform: 'none',
              color: theme.palette.text.secondary,
              borderColor: theme.palette.text.secondary,
              '&:hover': {
                borderColor: theme.palette.text.secondary,
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            {t('importChat')}
          </Button>
        )}

        <Button
          startIcon={<FileDownloadIcon />}
          onClick={handleExport}
          variant="outlined"
          size="small"
          sx={{
            textTransform: 'none',
            color: theme.palette.text.secondary,
            borderColor: theme.palette.text.secondary,
            '&:hover': {
              borderColor: theme.palette.text.secondary,
              backgroundColor: 'rgba(0, 0, 0, 0.04)'
            }
          }}
        >
          {t('exportChat')}
        </Button>
      </Box>
    </Stack>
  )
}

export default React.memo(ModelSettingDialog)
