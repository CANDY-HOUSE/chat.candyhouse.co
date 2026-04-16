import React from 'react'
import { Box, Typography } from '@mui/material'
import { FixedSizeList as List } from 'react-window'

interface Props {
  visible: boolean
  statusArr: string[]
}

const RealtimeDevtool: React.FC<Props> = ({ visible, statusArr }) => {
  if (!visible) return null

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div
      style={{
        ...style,
        borderBottom: index < statusArr.length - 1 ? '1px solid #98F0FF' : 'none',
        display: 'flex',
        alignItems: 'center'
      }}
    >
      <Typography
        sx={{
          fontSize: '12px',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          wordBreak: 'normal'
        }}
      >
        {statusArr[index]}
      </Typography>
    </div>
  )

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        flexDirection: 'column',
        position: 'absolute',
        top: '100%',
        right: '0.8rem',
        background: '#F8FDFE',
        border: '1px solid #98F0FF',
        width: '70%',
        maxWidth: '375px',
        height: '50vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        px: '.6rem'
      }}
    >
      <List
        height={window.innerHeight * 0.5}
        itemCount={statusArr.length}
        itemSize={40}
        width="100%"
      >
        {Row}
      </List>
    </Box>
  )
}

export default React.memo(RealtimeDevtool)
