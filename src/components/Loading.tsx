import { CircularProgress } from '@mui/material'
import React from 'react'

interface Props {
  visible: boolean
  size?: number
  fullScreen?: boolean
}

const Loading: React.FC<Props> = ({ visible = false, size = 40, fullScreen = true }) => {
  if (!visible) return null

  return (
    <React.Fragment>
      <svg width={0} height={0}>
        <defs>
          <linearGradient id="my_gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00B4DB" />
            <stop offset="25%" stopColor="#9B59B6" />
            <stop offset="50%" stopColor="#E74C3C" />
            <stop offset="75%" stopColor="#F1C40F" />
            <stop offset="100%" stopColor="#27AE60" />
          </linearGradient>
        </defs>
      </svg>
      <div
        style={{
          position: fullScreen ? 'fixed' : 'absolute',
          margin: 'auto auto',
          zIndex: 999,
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transition: 'opacity 0.3s'
        }}
      >
        <CircularProgress
          size={size}
          sx={{
            'svg circle': { stroke: 'url(#my_gradient)' }
          }}
        />
      </div>
    </React.Fragment>
  )
}

export default React.memo(Loading)
