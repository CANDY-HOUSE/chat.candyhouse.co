import { userAtom } from '@/store'
import { apiLogout } from '@api'
import { BIZ_URL, config } from '@config'
import { Login } from '@mui/icons-material'
import LogoutIcon from '@mui/icons-material/Logout'
import SubscriptionsIcon from '@mui/icons-material/Subscriptions'
import { Box, Divider, IconButton, Stack, Typography } from '@mui/material'
import { useAtomValue } from 'jotai'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

interface ListItemProps {
  onClick: () => void
  icon: React.ReactNode
  text: string
}

const ListItem: React.FC<ListItemProps> = ({ onClick, icon, text }) => {
  return (
    <Stack direction="row" alignItems="center" spacing={2} onClick={onClick}>
      <IconButton size="medium">{icon}</IconButton>
      <Typography variant="body1">{text}</Typography>
    </Stack>
  )
}

export const Personal: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAtomValue(userAtom)

  const handleLoginOrOut = async (logout = false) => {
    if (logout) await apiLogout()
    navigate(config.paths.login)
  }

  const goToBiz = () => {
    window.open(`${BIZ_URL}/biz/settings`, '_blank')
  }

  return (
    <Box
      sx={{
        width: '14rem',
        p: 'var(--spacing-xs)',
        cursor: 'pointer'
      }}
    >
      {user?.isLogin ? (
        <ListItem
          onClick={() => handleLoginOrOut(true)}
          icon={
            <LogoutIcon
              sx={{
                fontSize: 'var(--icon-size-small)'
              }}
            />
          }
          text={t('exitSystem')}
        />
      ) : (
        <ListItem
          onClick={() => handleLoginOrOut()}
          icon={
            <Login
              sx={{
                fontSize: 'var(--icon-size-small)'
              }}
            />
          }
          text={t('signIn')}
        />
      )}
      {user?.isLogin && (
        <>
          <Divider sx={{ my: '6px' }} />
          <ListItem
            onClick={goToBiz}
            icon={
              <SubscriptionsIcon
                sx={{
                  fontSize: 'var(--icon-size-small)'
                }}
              />
            }
            text={t('Plan')}
          />
        </>
      )}
    </Box>
  )
}
