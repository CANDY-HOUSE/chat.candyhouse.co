import { apiPostModelConfig } from '@/api'
import { useConversation } from '@/hooks/useConversation'
import { useModel } from '@/hooks/useModel'
import { switchDialog, switchToast } from '@/store'
import { Level } from '@constants'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import InputAdornment from '@mui/material/InputAdornment'
import Stack from '@mui/material/Stack'
import { useTheme } from '@mui/material/styles'
import TextField from '@mui/material/TextField'
import { chat, enhanceEventParams } from '@utils'
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

const ModelSettingDialog: React.FC<Props> = ({ conversationId, changeCache }) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const { getModelName } = useModel()
  const { getAttrValue, pushMessage, getConversation } = useConversation()
  const modelInfo = getAttrValue(conversationId, 'modelInfo')!
  const modelName = getModelName(modelInfo.modelName)
  const conversation = getConversation(conversationId)
  const [userNL, setUserNL] = useState<string>(modelInfo.userNL || '')
  const [loading, setLoading] = useState<boolean>(false)

  const handleConfigGen = async () => {
    setLoading(true)
    try {
      const result = await apiPostModelConfig(modelName, userNL)

      if (result) {
        const { config, explanations } = result
        explanations.forEach((item) => {
          switchToast({
            visible: true,
            message: item.message,
            level: item.kind === 'applied' ? Level.success : Level.warning,
            duration: 6000
          })
        })
        changeCache({ jsonConfig: config, userNL })
      }
    } catch (error) {
      switchToast({
        visible: true,
        message: error instanceof Error ? error.message : t('SubmissionFail'),
        level: Level.error
      })
    } finally {
      setLoading(false)
    }
  }

  const handleConfigChange = (value: string) => {
    setUserNL(value)
    changeCache({ userNL: value, jsonConfig: {} })
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
          value={userNL}
          label={t('modelSetting.jsonConfig')}
          placeholder="用 grok 时打开 X Search Tool 搜索，顺便允许它搜图片。"
          slotProps={{
            inputLabel: { shrink: true },
            formHelperText: { sx: { fontSize: '0.65rem' } },
            input: {
              endAdornment: (
                <InputAdornment position="end" sx={{ alignSelf: 'flex-end', mb: -1.2, mr: -0.5 }}>
                  <Button
                    disabled={!userNL.trim() || loading}
                    size="small"
                    sx={{
                      background: 'var(--gradient-ai)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                    onClick={handleConfigGen}
                    loading={loading}
                  >
                    Ai generate
                  </Button>
                </InputAdornment>
              )
            },
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
          onChange={(e) => handleConfigChange(e.target.value)}
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
