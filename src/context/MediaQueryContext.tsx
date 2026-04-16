import React, { createContext, useContext, useMemo } from 'react'
import { useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'

interface MediaQueryContextType {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
}

const MediaQueryContext = createContext<MediaQueryContextType>({
  isMobile: false,
  isTablet: false,
  isDesktop: false
})

export const MediaQueryProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const theme = useTheme()

  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'))
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  window.$screenType = (isMobile && 'mobile') || (isTablet && 'tablet') || 'desktop'

  const value = useMemo(
    () => ({
      isMobile,
      isTablet,
      isDesktop
    }),
    [isMobile, isTablet, isDesktop]
  )

  return <MediaQueryContext.Provider value={value}>{children}</MediaQueryContext.Provider>
}

// 自定义Hook，用于在组件中获取媒体查询状态
export const useMediaQueryContext = () => {
  return useContext(MediaQueryContext)
}
