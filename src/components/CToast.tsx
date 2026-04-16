import { Alert, Snackbar } from '@mui/material'
import React from 'react'

export interface Props {
  open: boolean
  message: string
  level?: 'error' | 'warning' | 'info' | 'success'
  duration?: number
  onClose: () => void
}

export const CToast: React.FC<Props> = ({
  open,
  message,
  duration = 2000,
  level = 'info',
  onClose
}) => {
  const handleClose = (_: unknown) => {
    return onClose()
  }

  return (
    <Snackbar
      open={open}
      autoHideDuration={duration}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        severity={level}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          '& .MuiAlert-message': {
            fontSize: '.8rem'
          }
        }}
      >
        {message}
      </Alert>
    </Snackbar>
  )
}
