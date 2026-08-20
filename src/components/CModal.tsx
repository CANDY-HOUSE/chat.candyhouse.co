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
          // 弹窗外框用画布层，内部的输入框/下拉/折叠面板走 --surface-raised（见 theme.ts），
          // 两者必须不同色阶，否则弹窗内的控件会和外框融成一片
          background: 'var(--surface-canvas)',
          borderRadius: 'var(--radius-md)'
        }}
      >
        {children}
      </Box>
    </Modal>
  )
}
