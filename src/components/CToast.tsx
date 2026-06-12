import type { ToastItem } from '@/store/feedBack'
import { Alert, Box, Grow } from '@mui/material'
import React, { useEffect } from 'react'

export interface Props {
  toasts: ToastItem[]
  onClose: (id: number) => void
}

const ToastEntry: React.FC<{ toast: ToastItem; onClose: (id: number) => void }> = ({
  toast,
  onClose
}) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(toast.id), toast.duration ?? 2000)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onClose])

  return (
    <Grow in>
      <Alert
        severity={toast.level ?? 'info'}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          boxShadow: 3,
          '& .MuiAlert-message': {
            fontSize: '.8rem'
          }
        }}
      >
        {toast.message}
      </Alert>
    </Grow>
  )
}

export const CToast: React.FC<Props> = ({ toasts, onClose }) => {
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: (theme) => theme.zIndex.snackbar,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1
      }}
    >
      {toasts.map((toast) => (
        <ToastEntry key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </Box>
  )
}
