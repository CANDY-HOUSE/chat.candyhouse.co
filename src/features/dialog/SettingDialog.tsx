import { CSelect } from '@/components/CSelect'
import { fontSizeAtom, languageAtom } from '@/store'
import { db, utils } from '@/utils'
import CleaningServicesIcon from '@mui/icons-material/CleaningServices'
import { Box, IconButton, type SelectChangeEvent, Stack, Typography } from '@mui/material'
import { useAtom } from 'jotai'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const fontSizeOptions = {
  '14': 14,
  '16': 16,
  '18': 18,
  '21': 21,
  '24': 24,
  '28': 28
}

const langOptions = {
  ja: '日本語',
  en: 'English',
  zhTw: '繁体中文',
  zh: '简体中文'
}

const SettingDialog = () => {
  const [fileStorageSize, setFileStorageSize] = useState<string>(utils.formatFileSize(0))
  const [language, setLanguage] = useAtom(languageAtom)
  const [fontSize, setFontSize] = useAtom(fontSizeAtom)
  const { t } = useTranslation()

  const clearFileStorage = async () => {
    await db.clear()
    setFileStorageSize(utils.formatFileSize(0))
  }

  const chooseFontSize = (e: SelectChangeEvent) => {
    setFontSize(parseInt(e.target.value, 10))
  }

  const chooseLanguage = (e: SelectChangeEvent) => {
    setLanguage(e.target.value)
  }

  useEffect(() => {
    db.getSize().then((r) => {
      setFileStorageSize(utils.formatFileSize(r))
    })
  }, [])

  return (
    <Box
      sx={{
        width: '20rem',
        p: 'var(--spacing-md)'
      }}
    >
      <CSelect
        value={language}
        label={t('language')}
        onchange={chooseLanguage}
        options={langOptions}
      />

      <CSelect
        label={t('fontSize')}
        value={String(fontSize)}
        onchange={chooseFontSize}
        options={fontSizeOptions}
        valueKey="key"
      />

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="flex-end"
        onClick={clearFileStorage}
        sx={{
          mt: 'var(--spacing-lg)'
        }}
      >
        <IconButton disabled={fileStorageSize === utils.formatFileSize(0)} size="small">
          <CleaningServicesIcon
            sx={{
              fontSize: 'var(--icon-size-small)'
            }}
          />
        </IconButton>

        <Stack
          direction="row"
          alignItems="center"
          sx={{
            cursor: fileStorageSize === utils.formatFileSize(0) ? 'default' : 'pointer'
          }}
        >
          <Typography variant="body1" sx={{ ml: '0.5rem' }}>
            {t('fileCache')}
          </Typography>
          <Typography variant="body1" sx={{ ml: '0.5rem' }}>
            {fileStorageSize}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  )
}

export default React.memo(SettingDialog)
