import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import React, { useCallback } from 'react'

export type IDataListAction = {
  text: string
  secondary?: string
  icon?: React.ReactNode
  handle?: (id: string) => void
  disabled?: boolean
  divider?: boolean
}

interface Props {
  actions: Array<IDataListAction>
  id?: string
  dense?: boolean
  disablePadding?: boolean
  sx?: object
  children?: React.ReactNode
}

const listItemTextStyles = {
  primary: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  },
  secondary: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  }
}

export const DataList: React.FC<Props> = ({
  id,
  actions,
  dense = true,
  disablePadding = true,
  sx,
  children
}) => {
  const handleClick = useCallback(
    (handle?: (id: string) => void) => {
      return () => handle?.(id || '')
    },
    [id]
  )

  return (
    <List sx={sx} disablePadding={disablePadding} dense={dense}>
      {children && (
        <ListItem sx={{ px: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}>
          {children}
        </ListItem>
      )}
      {actions.map((item, index) => (
        <ListItem
          key={`${item.text}-${index}`}
          divider={item.divider}
          disablePadding={disablePadding}
          dense={dense}
          sx={{ px: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}
        >
          <ListItemButton
            sx={{ px: 0 }}
            onClick={handleClick(item.handle)}
            disabled={item.disabled}
          >
            {item.icon && (
              <ListItemIcon sx={{ minWidth: '32px', color: 'var(--text-secondary)' }}>
                {item.icon}
              </ListItemIcon>
            )}
            <ListItemText
              primary={item.text}
              secondary={item.secondary}
              slotProps={listItemTextStyles}
            />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  )
}
