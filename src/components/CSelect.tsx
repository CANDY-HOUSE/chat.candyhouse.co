import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select, { type SelectChangeEvent } from '@mui/material/Select'
import Typography from '@mui/material/Typography'
import React, { useEffect } from 'react'

interface Props {
  value?: string
  label: string
  valueKey?: 'key' | 'value'
  options?: { [key: string]: string | number }
  children?: React.ReactNode
  onchange: (e: SelectChangeEvent<string>) => void
  renderValue?: (value: string) => React.ReactNode
}

export const CSelect: React.FC<Props> = ({
  value = '',
  valueKey = 'key',
  label,
  children,
  options,
  onchange,
  renderValue
}) => {
  useEffect(() => {
    if (!children && !options)
      throw new Error('options and children cannot be empty at the same time')
  }, [children, options])

  return (
    <FormControl
      fullWidth
      variant="outlined"
      margin="normal"
      sx={{
        boxShadow: 'none',
        '& .MuiOutlinedInput-root': {
          '& fieldset': {
            border: 'none'
          },
          '&:hover fieldset': {
            border: 'none'
          },
          '&.Mui-focused fieldset': {
            border: 'none'
          }
        }
      }}
    >
      <InputLabel id="select-label">{label}</InputLabel>
      <Select
        labelId="select-label"
        id="select"
        label={label}
        value={value}
        onChange={onchange}
        renderValue={renderValue}
        MenuProps={{
          PaperProps: {
            elevation: 3,
            sx: {
              mt: 0,
              mb: 0,
              bgcolor: 'var(--grey-200)'
            }
          },
          MenuListProps: {
            dense: true,
            sx: {
              py: 0,
              px: 0
            }
          }
        }}
      >
        {children ||
          Object.entries(options!).map(([key, value]) => (
            <MenuItem
              key={key}
              value={valueKey === 'value' ? value : key}
              sx={{ py: 'var(--spacing-xs)' }}
            >
              <Typography variant="body1">{value}</Typography>
            </MenuItem>
          ))}
      </Select>
    </FormControl>
  )
}
