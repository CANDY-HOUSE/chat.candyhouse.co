import { IconButton, Tooltip } from '@mui/material'
import React from 'react'

interface Props {
  onClick: (arg: string) => void
  tooltip: string
  icon: React.ReactNode
  disabled?: boolean
  sx?: object
}

export const TooltipButton = (props: Props) => {
  return (
    <Tooltip title={props.tooltip} arrow>
      <IconButton
        sx={props.sx}
        disabled={props.disabled}
        onClick={() => {
          if (props.onClick) {
            props.onClick(props.tooltip)
          }
        }}
      >
        {props.icon}
      </IconButton>
    </Tooltip>
  )
}
