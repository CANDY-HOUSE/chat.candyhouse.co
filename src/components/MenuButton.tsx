import React, { useRef, useState } from 'react'
import { Button, Grow, Menu, MenuItem, Typography } from '@mui/material'

export type OptionType<T = string> = { label: string; value: T }

interface Props {
  options: Array<OptionType>
  itemClick: (op: OptionType) => void
  label?: string
  startIcon?: React.ReactNode
  endIcon?: React.ReactNode
}

export const MenuButton: React.FC<Props> = ({
  options,
  itemClick,
  label = '',
  startIcon,
  endIcon
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleMenuItemClick = (option: OptionType) => {
    itemClick && itemClick(option)
    handleClose()
  }

  return (
    <>
      <Button
        ref={buttonRef}
        variant="outlined"
        fullWidth
        startIcon={startIcon}
        endIcon={endIcon}
        sx={{
          color: 'var(--text-secondary)',
          borderColor: 'var(--text-secondary)',
          '&:hover': {
            backgroundColor: 'transparent'
          },
          ...((!label || label.trim() === '') && {
            '& .MuiButton-startIcon': {
              margin: 0
            },
            '& .MuiButton-endIcon': {
              margin: 0
            }
          })
        }}
        onClick={handleClick}
      >
        {label}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center'
        }}
        slotProps={{
          paper: {
            sx: {
              width: buttonRef.current?.offsetWidth || 'auto',
              minWidth: buttonRef.current?.offsetWidth || 'auto',
              maxWidth: buttonRef.current?.offsetWidth || 'auto',
              overflow: 'visible',
              mt: 0.5
            }
          }
        }}
        slots={{
          transition: Grow
        }}
      >
        {options.map((op) => (
          <MenuItem key={op.label} onClick={() => handleMenuItemClick(op)}>
            <Typography
              variant="body2"
              sx={{
                whiteSpace: 'normal',
                wordBreak: 'break-word'
              }}
            >
              {op.label}
            </Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
