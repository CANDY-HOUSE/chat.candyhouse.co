import { getLocalValue, localKey, putLocalValue } from '@/utils'
import { createTheme, type Theme } from '@mui/material/styles'
import { atom, getDefaultStore } from 'jotai'

declare module '@mui/material/styles' {
  interface Theme {
    scrollBar: {
      trackColor: string
      thumbColor: string
      hoverColor: string
    }
  }
}

export const BeanTheme = {
  light: 'light',
  dark: 'dark'
} as const

const createCustomTheme = (_mode: string): Theme => {
  return createTheme({
    palette: {
      text: {
        primary: '#1a1e23',
        secondary: '#757575'
      },
      background: {
        default: '#fff'
      }
    },
    typography: {
      fontFamily: 'inherit',

      h1: {
        fontSize: 'var(--heading-1)',
        lineHeight: 1.2
      },
      h2: {
        fontSize: 'var(--heading-2)',
        lineHeight: 1.2
      },
      h3: {
        fontSize: 'var(--heading-3)',
        lineHeight: 1.3
      },
      h4: {
        fontSize: 'var(--heading-4)',
        lineHeight: 1.3
      },
      h5: {
        fontSize: 'var(--heading-5)',
        lineHeight: 1.4
      },
      h6: {
        fontSize: 'var(--heading-6)',
        lineHeight: 1.4
      },
      body1: {
        fontSize: 'inherit', // 继承 body 的字体大小
        lineHeight: 1.5
      },
      body2: {
        fontSize: '0.875em',
        lineHeight: 1.4
      },
      subtitle1: {
        fontSize: 'var(--text-lg)',
        lineHeight: 1.4
      },
      subtitle2: {
        fontSize: 'var(--text-sm)',
        lineHeight: 1.4
      },
      caption: {
        fontSize: 'var(--text-xs)',
        lineHeight: 1.4
      },
      overline: {
        fontSize: 'var(--text-xs)',
        lineHeight: 1.4,
        textTransform: 'uppercase'
      }
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            fontSize: 'inherit'
          }
        }
      },

      MuiIconButton: {
        styleOverrides: {
          root: {
            fontSize: 'inherit',
            color: '#8f8f8f'
          }
        }
      },

      MuiSelect: {
        styleOverrides: {
          select: {
            backgroundColor: '#fff',
            fontSize: 'inherit'
          },
          outlined: {
            borderRadius: 'var(--radius-sm)'
          }
        }
      },

      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontSize: 'inherit'
          }
        }
      },

      MuiInputBase: {
        styleOverrides: {
          root: {
            fontSize: 'inherit'
          }
        }
      },

      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 'var(--radius-md)'
          }
        }
      },

      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: 'var(--spacing-md)',
            '&:last-child': {
              paddingBottom: 'var(--spacing-md)'
            }
          }
        }
      },

      MuiTextField: {
        styleOverrides: {
          root: {
            fontSize: 'inherit',
            marginBottom: 'var(--spacing-md)'
          }
        }
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-notchedOutline': {
              border: 'none'
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              border: 'none'
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              border: 'none'
            },
            backgroundColor: '#fff',
            borderRadius: 'var(--radius-sm)'
          }
        }
      }
    }
  })
}
const lightTheme = createCustomTheme(BeanTheme.light)
const darkTheme = createCustomTheme(BeanTheme.dark)

export const themeAtom = atom<Theme>(
  getLocalValue(localKey.theme) === BeanTheme.dark ? darkTheme : lightTheme
)

export const mThemeValueAtom = atom<string>(
  (getLocalValue(localKey.theme) as string) || BeanTheme.light
)

export const changeTheme = (themeName: string) => {
  const newTheme = themeName === BeanTheme.dark ? darkTheme : lightTheme
  putLocalValue(localKey.theme, themeName)
  getDefaultStore().set(mThemeValueAtom, themeName)
  getDefaultStore().set(themeAtom, newTheme)
}
