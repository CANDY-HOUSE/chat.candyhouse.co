import type { BeanAnchor } from '@/types/beantypes'
import { Box, Popover, type PopoverOrigin, type PopoverProps } from '@mui/material'
import React, { useMemo } from 'react'

interface Props {
  children: React.ReactNode
  config?: BeanAnchor
  onClose?: () => void
}

const ANCHOR_STYLES = {
  paper: {
    borderRadius: '8px',
    overflow: 'hidden'
  },
  origin: {
    vertical: 'top' as const,
    horizontal: 'left' as const
  }
}

const DEFAULT_POPOVER_PROPS: Partial<PopoverProps> = {
  id: 'simple-popover',
  anchorReference: 'anchorPosition',
  anchorOrigin: ANCHOR_STYLES.origin,
  transformOrigin: ANCHOR_STYLES.origin
}

export const CAnchor: React.FC<Props> = ({ children, config, onClose }) => {
  const origin = useMemo(() => {
    if (!config || !config.origin) return null
    const rect = (config.origin as Element).getBoundingClientRect()

    const isNearRight = rect.left > window.innerWidth / 2
    const isNearBottom = rect.top > window.innerHeight / 2

    const anchorOrigin: PopoverOrigin = {
      vertical: isNearBottom ? 'top' : 'bottom',
      horizontal: isNearRight ? 'right' : 'left'
    }

    const transformOrigin: PopoverOrigin = {
      vertical: isNearBottom ? 'bottom' : 'top',
      horizontal: isNearRight ? 'right' : 'left'
    }

    return { anchorOrigin, transformOrigin }
  }, [config])

  const popoverProps = React.useMemo(() => {
    const ret = { ...DEFAULT_POPOVER_PROPS }

    if (origin) {
      delete ret.anchorReference
      ret.disablePortal = false
      ret.anchorEl = config?.origin
      ret.anchorOrigin = origin.anchorOrigin
      ret.transformOrigin = origin.transformOrigin
    } else {
      ret.anchorPosition = config
        ? {
            top: config.top,
            left: config.left
          }
        : undefined
    }

    return {
      ...ret,
      open: Boolean(config),
      onClose,
      sx: {
        '& .MuiPopover-paper': {
          ...ANCHOR_STYLES.paper,
          background: '#fff'
        }
      }
    }
  }, [config, onClose, origin])

  return (
    <Popover {...popoverProps}>
      <Box sx={{ background: '#fff' }}>{children}</Box>
    </Popover>
  )
}
