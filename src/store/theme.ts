import { getLocalValue, localKey, putLocalValue } from '@/utils'
import { darkColors, lightColors } from '@/styles/colorTokens'
import { createTheme, type Theme } from '@mui/material/styles'
import { atom } from 'jotai'
import { store } from './index'

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

const getInitialMode = (): string => {
  const stored = getLocalValue(localKey.theme) as string | null
  if (stored === BeanTheme.dark || stored === BeanTheme.light) return stored
  const prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? BeanTheme.dark : BeanTheme.light
}

const createCustomTheme = (mode: string): Theme => {
  const tokens = mode === BeanTheme.dark ? darkColors : lightColors

  return createTheme({
    palette: {
      mode: mode === BeanTheme.dark ? 'dark' : 'light',
      text: {
        primary: tokens.textPrimary,
        secondary: tokens.textSecondary
      },
      background: {
        // default 对应 pageBackground（浅色纯白，深色画布色，供整页背景如登录页使用）；
        // paper 对应 surfaceRaised（菜单/弹窗/卡片），两者语义不同，避免 MUI 回退到自带的 #121212
        default: tokens.pageBackground,
        paper: tokens.surfaceRaised
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
            color: tokens.textSecondary
          }
        }
      },

      MuiSelect: {
        styleOverrides: {
          select: {
            backgroundColor: tokens.surfaceRaised,
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

      // 深色模式下 boxShadow 层级感很弱，菜单/弹层改用边框分层
      MuiMenu: {
        styleOverrides: {
          paper: {
            border: `1px solid ${tokens.borderDefault}`
          }
        }
      },

      MuiPopover: {
        styleOverrides: {
          paper: {
            border: `1px solid ${tokens.borderDefault}`
          }
        }
      },

      MuiDialog: {
        styleOverrides: {
          paper: {
            border: `1px solid ${tokens.borderDefault}`
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
            backgroundColor: tokens.surfaceRaised,
            borderRadius: 'var(--radius-sm)'
          }
        }
      }
    }
  })
}
const lightTheme = createCustomTheme(BeanTheme.light)
const darkTheme = createCustomTheme(BeanTheme.dark)

const initialMode = getInitialMode()

export const themeAtom = atom<Theme>(initialMode === BeanTheme.dark ? darkTheme : lightTheme)

export const mThemeValueAtom = atom<string>(initialMode)

export const changeTheme = (themeName: string) => {
  const newTheme = themeName === BeanTheme.dark ? darkTheme : lightTheme
  putLocalValue(localKey.theme, themeName)
  store.set(mThemeValueAtom, themeName)
  store.set(themeAtom, newTheme)
}
