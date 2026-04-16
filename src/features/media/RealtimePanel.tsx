import { useMediaQueryContext } from '@/context/MediaQueryContext'
import {
  devtoolVisibleAtom,
  editorHeightAtom,
  realtimStatusAtom,
  UI_CONSTANTS,
  viewTypeAtom
} from '@/store'
import { ViewModel } from '@constants'
import CloseIcon from '@mui/icons-material/Close'
import CodeIcon from '@mui/icons-material/Code'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useAtom, useAtomValue } from 'jotai'
import React, { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const RealtimePanel = () => {
  const { t } = useTranslation()
  const { isMobile } = useMediaQueryContext()
  const editorH = useAtomValue(editorHeightAtom)
  const editorHeight = isMobile ? UI_CONSTANTS.mobileEditorHeight : editorH
  const [viewType, setViewType] = useAtom(viewTypeAtom)
  const [devToolVisible, setDevToolVisible] = useAtom(devtoolVisibleAtom)
  const realtimStatus = useAtomValue(realtimStatusAtom)
  const realtimStatusMap: Record<string, string> = {
    'input_audio_buffer.speech_started': t('realtime.statusText.speechInput'),
    'input_audio_buffer.speech_stopped': t('realtime.statusText.speechDone'),
    'response.audio_transcript.delta': t('realtime.statusText.modelDelta'),
    'response.done': t('realtime.statusText.modelDelta'),
    'output_audio_buffer.stopped': t('realtime.statusText.idel')
  }
  const realtimeStatusPrevTextRef = useRef(t('realtime.statusText.idel'))

  const realtimeStatusText = useMemo(() => {
    switch (viewType) {
      case ViewModel.voicePause:
        return t('realtime.statusText.micOff')
      case ViewModel.voiceActive: {
        let ret = realtimStatusMap[realtimStatus]
        if (!ret) {
          ret = realtimeStatusPrevTextRef.current
        } else {
          realtimeStatusPrevTextRef.current = realtimStatusMap[realtimStatus] ?? ''
        }
        return ret
      }
    }
  }, [realtimStatus, viewType])

  return (
    <Box
      sx={{
        position: 'relative',
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: `${editorHeight}px`,
        boxShadow: '0 -7px 29px 0 rgba(100, 100, 111, 0.2)',
        pt: 'var(--spacing-md)'
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="center" spacing={10}>
        <IconButton
          aria-label="mic"
          disabled={viewType === ViewModel.voice}
          onClick={() =>
            setViewType(
              viewType === ViewModel.voiceActive ? ViewModel.voicePause : ViewModel.voiceActive
            )
          }
        >
          {viewType === ViewModel.voiceActive ? (
            <MicIcon
              color="success"
              sx={{
                fontSize: '3rem!important'
              }}
            />
          ) : (
            <MicOffIcon
              color="error"
              sx={{
                fontSize: '3rem!important'
              }}
            />
          )}
        </IconButton>
        <IconButton aria-label="cancel" onClick={() => setViewType(ViewModel.normal)}>
          <CloseIcon
            sx={{
              fontSize: '3rem!important'
            }}
          />
        </IconButton>
      </Stack>

      {!isMobile && (
        <Typography
          variant="h3"
          sx={{
            textAlign: 'center',
            mt: 'var(--spacing-md)'
          }}
        >
          {realtimeStatusText}
        </Typography>
      )}

      <IconButton
        aria-label="dev"
        sx={{ position: 'absolute', right: '.4rem', top: '.4rem' }}
        onClick={() => setDevToolVisible(!devToolVisible)}
      >
        <CodeIcon />
      </IconButton>
    </Box>
  )
}

export default React.memo(RealtimePanel)
