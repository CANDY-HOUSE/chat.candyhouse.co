import { useMediaQueryContext } from '@/context/MediaQueryContext'
import { ResizableDividerLeft } from '@/features/common/ResizableDividerLeft'
import MainContent from '@/pages/home/components/MainContent'
import Sidebar from '@/pages/home/components/Sidebar'
import { isShowSideBarAtom } from '@/store'
import Stack from '@mui/material/Stack'
import { useTheme } from '@mui/material/styles'
import { useAtomValue } from 'jotai'
import React, { useEffect, useState } from 'react'

const HomePage = () => {
  const theme = useTheme()
  const { isMobile } = useMediaQueryContext()
  const isShowSideBar = useAtomValue(isShowSideBarAtom)

  const [windowHeight, setWindowHeight] = useState('100vh')

  useEffect(() => {
    // 设置初始高度
    setWindowHeight(`${window.innerHeight}px`)

    // 监听窗口大小变化
    const handleResize = () => {
      setWindowHeight(`${window.innerHeight}px`)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <Stack
      direction="row"
      alignItems="stretch"
      sx={{
        position: 'relative',
        height: windowHeight,
        width: '100%',
        overflow: 'hidden',
        background: theme.palette.background.default
      }}
    >
      <Sidebar />

      {isShowSideBar && !isMobile && <ResizableDividerLeft />}

      <MainContent />
    </Stack>
  )
}

export default React.memo(HomePage)
