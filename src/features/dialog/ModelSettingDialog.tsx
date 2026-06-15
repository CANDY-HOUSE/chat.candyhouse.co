import { apiPostModelConfig } from '@/api'
import { useConversation } from '@/hooks/useConversation'
import { useModel } from '@/hooks/useModel'
import { switchDialog, switchToast } from '@/store'
import { Level } from '@constants'
import ArrowForwardIosSharpIcon from '@mui/icons-material/ArrowForwardIosSharp'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import MuiAccordionSummary, {
  accordionSummaryClasses,
  AccordionSummaryProps
} from '@mui/material/AccordionSummary'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import InputAdornment from '@mui/material/InputAdornment'
import Stack from '@mui/material/Stack'
import { styled, useTheme } from '@mui/material/styles'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
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

const AccordionSummary = styled((props: AccordionSummaryProps) => (
  <MuiAccordionSummary
    expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: '0.7rem' }} />}
    {...props}
  />
))(({ theme }) => ({
  padding: 0,
  minHeight: '38px!important',
  backgroundColor: 'var(--color-background)',
  flexDirection: 'row-reverse',
  [`& .${accordionSummaryClasses.expandIconWrapper}`]: {
    margin: 0
  },
  [`& .${accordionSummaryClasses.expandIconWrapper}.${accordionSummaryClasses.expanded}`]: {
    transform: 'rotate(90deg)',
    margin: 0
  },
  [`& .${accordionSummaryClasses.content}`]: {
    margin: theme.spacing(1)
  },
  [`& .${accordionSummaryClasses.content}.${accordionSummaryClasses.expanded}`]: {
    margin: theme.spacing(1)
  }
}))

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
  const [formattedJsonConfig, setFormattedJsonConfig] = useState<string>(
    JSON.stringify(modelInfo.jsonConfig || {}, null, 2)
  )

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
        setFormattedJsonConfig(JSON.stringify(config, null, 2))
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
          overflow: 'hidden'
        }}
      >
        <TextField
          fullWidth
          multiline
          minRows={4}
          maxRows={12}
          variant="outlined"
          value={userNL}
          label={t('modelSetting.jsonConfig')}
          placeholder="【例】インターネットに接続してください。回答の創造性・温度感は普通。"
          slotProps={{
            inputLabel: { shrink: true },
            formHelperText: { sx: { fontSize: '0.65rem' } },
            input: {
              sx: {
                position: 'relative',
                '& .MuiInputBase-inputMultiline': {
                  pb: 4
                }
              },
              endAdornment: (
                <InputAdornment
                  position="end"
                  sx={{ position: 'absolute', right: 8, bottom: 6, m: 0, bgcolor: '#fff' }}
                >
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
                    Configを生成して適用
                  </Button>
                </InputAdornment>
              )
            },
            htmlInput: {
              sx: {
                overflowY: 'auto!important',
                overflowX: 'hidden!important',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
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

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={4}
        justifyContent={{ md: 'space-between' }}
      >
        <Box sx={{ width: { xs: '100%', md: '60%' } }}>
          <Accordion sx={{ boxShadow: 'none' }}>
            <AccordionSummary>
              <Typography component="span">Config</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography
                component="pre"
                sx={{
                  m: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'monospace'
                }}
              >
                {formattedJsonConfig}
              </Typography>
            </AccordionDetails>
          </Accordion>
        </Box>

        <Box sx={{ display: 'flex', columnGap: 2 }}>
          {conversationId && (
            <Button
              startIcon={<FileUploadIcon />}
              onClick={handleImport}
              variant="outlined"
              size="small"
              sx={{
                width: { xs: '100%', md: 'fit-content' },
                height: 'fit-content',
                textTransform: 'none',
                color: theme.palette.text.secondary,
                borderColor: theme.palette.text.secondary,
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
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
              width: { xs: '100%', md: 'fit-content' },
              height: 'fit-content',
              textTransform: 'none',
              color: theme.palette.text.secondary,
              borderColor: theme.palette.text.secondary,
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
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
    </Stack>
  )
}

export default React.memo(ModelSettingDialog)
