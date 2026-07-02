import { IconButton, Tooltip } from '@mui/material'
import type { IconButtonProps } from '@mui/material/IconButton'
import type { TooltipProps } from '@mui/material/Tooltip'
import type { ReactNode } from 'react'

interface Props extends Omit<IconButtonProps, 'children' | 'onClick'> {
  onClick?: (arg: string | ReactNode) => void
  tooltip: TooltipProps['title']
  icon: ReactNode
  tooltipProps?: Omit<TooltipProps, 'children' | 'title'>
}

export const TooltipButton = ({
  tooltip,
  icon,
  onClick,
  tooltipProps,
  ...iconButtonProps
}: Props) => {
  return (
    <Tooltip arrow {...tooltipProps} title={tooltip}>
      <IconButton
        {...iconButtonProps}
        onClick={() => {
          onClick?.(tooltip)
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  )
}
