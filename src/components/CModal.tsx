import React from 'react'
import { Modal, Box } from '@mui/material'

interface Props {
  open: boolean
  children: React.ReactNode
  onClose?: () => void
}

export const CModal: React.FC<Props> = ({ open, children, onClose }) => {
  const handleClose = () => {
    onClose && onClose()
  }

  return (
    <Modal open={open} onClose={handleClose}>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--color-background)',
          borderRadius: 'var(--radius-md)'
        }}
      >
        {children}
      </Box>
    </Modal>
  )
}
