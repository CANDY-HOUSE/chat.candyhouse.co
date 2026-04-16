import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { styled } from '@mui/material/styles'
import React from 'react'

const IOSSwitch = styled(
  Switch,
  {}
)(({ theme }) => ({
  width: 'calc(var(--icon-size) * 1.125)',
  height: 'calc(var(--icon-size) * 3 / 4)',
  padding: 0,
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 'calc(100% + 16px)',
    height: 'calc(100% + 16px)',
    minWidth: '44px',
    minHeight: '44px'
  },
  '& .MuiSwitch-switchBase': {
    padding: 'calc(var(--icon-size) * 0.05625)',
    margin: 0,
    transitionDuration: '300ms',
    '&.Mui-checked': {
      transform: 'translateX(calc(var(--icon-size) * 3 / 8))',
      color: '#fff',
      '& + .MuiSwitch-track': {
        backgroundColor: 'var(--text-secondary)',
        opacity: 1,
        border: 0
      }
    }
  },
  '& .MuiSwitch-thumb': {
    boxSizing: 'border-box',
    width: 'calc(var(--icon-size) * 0.6375)',
    height: 'calc(var(--icon-size) * 0.6375)'
  },
  '& .MuiSwitch-track': {
    borderRadius: 'calc(var(--icon-size) * 3 / 8)',
    backgroundColor: 'var(--grey-200)',
    opacity: 1,
    transition: theme.transitions.create(['background-color'], {
      duration: 500
    })
  }
}))

interface Props {
  label?: string
  checked?: boolean
  onChange?: (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => void
}

export const CSwitch: React.FC<Props> = (props) => {
  return props.label ? (
    <FormControlLabel
      control={<IOSSwitch checked={props.checked} onChange={props.onChange} />}
      label={
        <Typography variant="body1" className="pl-xs">
          {props.label}
        </Typography>
      }
      sx={{
        m: 0
      }}
    />
  ) : (
    <IOSSwitch checked={props.checked} onChange={props.onChange} />
  )
}
