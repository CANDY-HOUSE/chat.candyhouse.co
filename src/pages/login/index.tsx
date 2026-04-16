import { useMediaQueryContext } from '@/context/MediaQueryContext'
import { switchToast } from '@/store'
import { apiAuth, apiLogin } from '@api'
import { icons } from '@assets/icons'
import { config } from '@config'
import { Level } from '@constants'
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft'
import { Box, Button, Link, Stack, TextField, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { utils } from '@utils'
import React, { type ChangeEvent, type FormEvent, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

const LoginPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isMobile } = useMediaQueryContext()
  const theme = useTheme()
  const [email, setEmail] = useState<string>('')
  const [loginStep, setLoginStep] = useState<number>(1)
  const [userData, setUserData] = useState<unknown>()
  const emailValid = useMemo(() => utils.checkEmail(email), [email])

  const handleEmailSubmit = (event: FormEvent) => {
    event.preventDefault()
    apiLogin(email).then((data) => {
      if (data.isOk) {
        setUserData(data.data)
        setLoginStep(2)
      }
    })
  }

  const handleCodeSubmit = (event: ChangeEvent<HTMLInputElement>) => {
    const code = event.target.value
    if (code.length === 4) {
      apiAuth(userData, code).then((data) => {
        if (data.isOk) {
          navigate(config.paths.home)
        } else {
          switchToast({ visible: true, message: t('authCodeError'), level: Level.error })
        }
      })
    }
  }

  const handleBack = (event: FormEvent) => {
    event.preventDefault()
    setEmail('')
    setUserData(null)
    setLoginStep(1)
  }

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        overflow: 'hidden',
        backgroundColor: theme.palette.background.default
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <img
          src={icons.candyhouseLogo}
          alt="logo"
          style={{
            maxHeight: '8rem',
            width: 'auto',
            marginTop: '20vh',
            marginBottom: '2rem',
            maxWidth: '100%',
            objectFit: 'contain'
          }}
        />

        <Stack
          direction="column"
          alignItems="center"
          spacing={4}
          sx={{
            maxWidth: isMobile ? '76%' : '720px'
          }}
        >
          {loginStep === 1 && (
            <>
              <TextField
                fullWidth
                placeholder={t('emailAddress')}
                variant="standard"
                margin="normal"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                slotProps={{
                  htmlInput: {
                    pattern: '[a-zA-Z0-9@]*'
                  },
                  input: {
                    style: {
                      color: theme.palette.text.primary
                    }
                  }
                }}
              />

              <Typography variant="body1" sx={{ width: '100%' }}>
                <Link
                  href="https://jp.candyhouse.co/pages/sesamebiz_terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                  sx={{ color: 'teal', mx: 'var(--spacing-xs)' }}
                >
                  {t('termsofuse')}
                </Link>
                {t('and')}
                <Link
                  href="https://jp.candyhouse.co/pages/privacy_policy"
                  underline="hover"
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    color: 'teal',
                    mx: 'var(--spacing-xs)'
                  }}
                >
                  {t('privacypolicy')}&nbsp;
                </Link>
                {t('loginbyagree')}
              </Typography>

              <Button
                variant="contained"
                disabled={!emailValid}
                onClick={handleEmailSubmit}
                sx={{
                  width: '100%',
                  backgroundColor: 'var(--button--primary)',
                  color: '#ffffff',
                  '&.Mui-disabled': {
                    backgroundColor: 'var(--bg-disabled)',
                    color: 'var(--text-disabled)'
                  }
                }}
              >
                {t('login')}
              </Button>
            </>
          )}

          {loginStep === 2 && (
            <>
              <Box sx={{ width: '100%' }}>
                <Typography
                  variant="body1"
                  gutterBottom
                  align="center"
                  color={'var(--text-secondary)'}
                >
                  {t('inputEmail')}
                </Typography>

                <TextField
                  fullWidth
                  placeholder={t('confirmationCode')}
                  variant="standard"
                  margin="normal"
                  type="number"
                  onChange={handleCodeSubmit}
                  slotProps={{
                    htmlInput: {
                      inputMode: 'numeric',
                      pattern: '[0-9]*',
                      type: 'number'
                    },
                    input: {
                      style: {
                        color: theme.palette.text.primary
                      }
                    }
                  }}
                />
              </Box>

              <Stack
                direction="row"
                alignItems="center"
                justifyContent="center"
                spacing={1}
                sx={{
                  color: 'var(--button--primary)',
                  cursor: 'pointer'
                }}
                onClick={handleBack}
              >
                <KeyboardArrowLeftIcon />
                <Typography variant="body1">{t('backToPreviousPage')}</Typography>
              </Stack>
            </>
          )}
        </Stack>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <img
          alt="icon"
          style={{ width: isMobile ? '46%' : '36%' }}
          src="https://cdn.shopify.com/s/files/1/0016/1870/6495/files/busniess.png?v=1663835284"
        />
        <img
          alt="icon"
          style={{ width: isMobile ? '46%' : '36%' }}
          src="https://cdn.shopify.com/s/files/1/0016/1870/6495/files/girlAndDoor-07.png?v=1663835270"
        />
      </Box>
    </Box>
  )
}

export default React.memo(LoginPage)
