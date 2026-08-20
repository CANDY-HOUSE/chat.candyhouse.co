import { useConversation } from '@/hooks/useConversation'
import { useModel } from '@/hooks/useModel'
import { setDialogDisableClose, switchDialog, switchToast } from '@/store'
import type { IModelInfo } from '@/types/messagetypes'
import { Level } from '@constants'
import ArrowForwardIosSharpIcon from '@mui/icons-material/ArrowForwardIosSharp'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
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
import type { Theme } from '@mui/material/styles'
import { styled, useTheme } from '@mui/material/styles'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { chat, enhanceEventParams } from '@utils'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConfigDomainContext } from './configDomains'
import { CONFIG_DOMAIN_ORDER, CONFIG_DOMAINS, runConfigGen } from './configDomains'

interface Props {
  conversationId: string
  changeCache: (data: Partial<IModelInfo>) => void
}

const customStyle = {
  container: {
    width: 'max(20rem, 60vw)',
    p: 'var(--spacing-md)'
  }
}

const AccordionSummary = styled((props: AccordionSummaryProps) => (
  <MuiAccordionSummary
    expandIcon={
      <ArrowForwardIosSharpIcon sx={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }} />
    }
    {...props}
  />
))(({ theme }) => ({
  padding: 0,
  minHeight: '38px!important',
  backgroundColor: 'var(--surface-raised)',
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

const actionButtonSx = (theme: Theme) => ({
  width: { xs: '100%', md: 'fit-content' },
  height: 'fit-content',
  textTransform: 'none' as const,
  color: theme.palette.text.secondary,
  borderColor: theme.palette.text.secondary,
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  whiteSpace: 'nowrap' as const,
  '&:hover': {
    borderColor: theme.palette.text.secondary,
    backgroundColor: 'var(--bg-hover)'
  }
})

const ModelSettingDialog: React.FC<Props> = ({ conversationId, changeCache }) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const { getModelName } = useModel()
  const { getAttrValue, pushMessage, getConversation } = useConversation()
  const initialModelInfo = getAttrValue(conversationId, 'modelInfo')!
  const modelName = getModelName(initialModelInfo.modelName)
  const conversation = getConversation(conversationId)

  const [nl, setNl] = useState(initialModelInfo.userNL ?? '')

  // 单一草稿：既驱动渲染（含合并预览），也决定落库内容。
  const [draft, setDraft] = useState<IModelInfo>(initialModelInfo)
  const draftRef = useRef(draft)
  draftRef.current = draft

  // 单飞：只有一个按钮，一次只允许一次生成在途；命中哪些域由后端分类器决定。
  const [loading, setLoading] = useState(false)

  // 生成中不允许通过遮罩/ESC 关闭弹窗，避免中途关闭丢失即将写回的结果。
  useEffect(() => {
    setDialogDisableClose(loading)
  }, [loading])

  const patchDraft = useCallback(
    (patch: Partial<IModelInfo>) => {
      draftRef.current = { ...draftRef.current, ...patch }
      setDraft(draftRef.current)
      changeCache(patch)
    },
    [changeCache]
  )

  const ctx: ConfigDomainContext = useMemo(
    () => ({ conversationId, modelName, getDraft: () => draftRef.current, patchDraft }),
    [conversationId, modelName, patchDraft]
  )

  const mergedPreview = useMemo(
    () =>
      Object.fromEntries(
        CONFIG_DOMAIN_ORDER.map((domain) => [domain, CONFIG_DOMAINS[domain].preview.select(draft)])
      ),
    [draft]
  )

  const handleConfigGen = async () => {
    setLoading(true)
    try {
      const { explanations, domains } = await runConfigGen(nl, ctx)

      explanations.forEach((item) => {
        switchToast({
          visible: true,
          message: item.message,
          level: item.kind === 'applied' ? Level.success : Level.warning,
          duration: 6000
        })
      })

      patchDraft({ userNL: nl })

      domains.forEach((domain) => {
        gtag(
          'event',
          'model_management',
          enhanceEventParams({
            action_type: CONFIG_DOMAINS[domain].gtagAction,
            model_name: modelName
          })
        )
      })
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === 'AbortError'
      switchToast({
        visible: true,
        message: isTimeout
          ? t('modelSetting.genTimeout')
          : error instanceof Error
            ? error.message
            : t('SubmissionFail'),
        level: Level.error
      })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setNl('')
    patchDraft({ jsonConfig: {}, convConfig: {}, userNL: undefined })
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
          value={nl}
          label={t('modelSetting.nlLabel')}
          placeholder={t('modelSetting.placeholder')}
          slotProps={{
            inputLabel: { shrink: true },
            formHelperText: { sx: { fontSize: '0.6rem' } },
            input: {
              sx: {
                position: 'relative',
                '& .MuiInputBase-inputMultiline': {
                  pb: 7
                }
              },
              endAdornment: (
                <InputAdornment
                  position="end"
                  sx={{
                    position: 'absolute',
                    right: 8,
                    bottom: 6,
                    m: 0,
                    bgcolor: 'var(--surface-raised)',
                    borderRadius: 1,
                    maxWidth: 'calc(100% - 16px)'
                  }}
                >
                  <Button
                    disabled={!nl.trim() || loading}
                    size="small"
                    sx={{
                      minWidth: 'auto',
                      whiteSpace: 'nowrap',
                      ...(loading
                        ? {}
                        : {
                            background: 'var(--gradient-ai)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                          }),
                      '&.Mui-disabled': {
                        WebkitTextFillColor: 'unset',
                        opacity: 0.4
                      }
                    }}
                    onClick={handleConfigGen}
                    loading={loading}
                  >
                    {t('modelSetting.generate')}
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
          onChange={(e) => setNl(e.target.value)}
        />
      </Box>

      <Box sx={{ width: '100%' }}>
        <Accordion
          sx={{
            boxShadow: 'none',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden'
          }}
        >
          <AccordionSummary>
            <Typography
              component="span"
              sx={{
                fontSize: '.6rem',
                color: 'var(--text-secondary)'
              }}
            >
              {t('modelSetting.configPreview')}
            </Typography>
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
              {JSON.stringify(mergedPreview, null, 2)}
            </Typography>
          </AccordionDetails>
        </Accordion>
      </Box>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        justifyContent={{ md: 'flex-end' }}
      >
        <Box sx={{ display: 'flex', columnGap: 2 }}>
          <Button
            startIcon={<RestartAltIcon />}
            onClick={handleReset}
            variant="outlined"
            size="small"
            sx={actionButtonSx(theme)}
          >
            {t('modelSetting.reset')}
          </Button>

          {conversationId && (
            <Button
              startIcon={<FileUploadIcon />}
              onClick={handleImport}
              variant="outlined"
              size="small"
              sx={actionButtonSx(theme)}
            >
              {t('importChat')}
            </Button>
          )}

          <Button
            startIcon={<FileDownloadIcon />}
            onClick={handleExport}
            variant="outlined"
            size="small"
            sx={actionButtonSx(theme)}
          >
            {t('exportChat')}
          </Button>
        </Box>
      </Stack>
    </Stack>
  )
}

export default React.memo(ModelSettingDialog)
