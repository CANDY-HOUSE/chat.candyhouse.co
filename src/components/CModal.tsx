import React from 'react'
import { Modal, Box } from '@mui/material'

interface Props {
  open: boolean
  children: React.ReactNode
  onClose?: () => void
  /** true 时忽略遮罩点击 / ESC，弹窗只能通过内部逻辑关闭（或由调用方另行 switchDialog 关闭）。 */
  disableClose?: boolean
}

export const CModal: React.FC<Props> = ({ open, children, onClose, disableClose }) => {
  const handleClose = () => {
    if (disableClose) return
    onClose && onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} disableEscapeKeyDown={disableClose}>
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
