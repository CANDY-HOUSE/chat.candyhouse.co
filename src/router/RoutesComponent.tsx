import { CAnchor } from '@/components/CAnchor'
import { CModal } from '@/components/CModal'
import { CToast } from '@/components/CToast'
import { PageLoader } from '@/components/PageLoader'
import { useMediaQueryContext } from '@/context/MediaQueryContext'
import {
  anchorAtom,
  authStatusAtom,
  dialogAtom,
  dismissToast,
  imagePreviewSrcsAtom,
  isShowSideBarAtom,
  resetAllAtoms,
  store,
  switchAnchor,
  switchDialog,
  toastsAtom,
  userAtom
} from '@/store'
import { apiAuthToken } from '@api'
import { config } from '@config'
import { useAtomValue, useSetAtom } from 'jotai'
import React, { lazy, Suspense, useEffect, useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import ImagePreview from '../features/common/ImagePreview'

const HomePage = lazy(() => import('../pages/home'))
const LoginPage = lazy(() => import('../pages/login'))

const RoutesComponent: React.FC = () => {
  const { isMobile } = useMediaQueryContext()
  const location = useLocation()
  const toasts = useAtomValue(toastsAtom)
  const anchor = useAtomValue(anchorAtom)
  const dialog = useAtomValue(dialogAtom)
  const imagePreviewSrcs = useAtomValue(imagePreviewSrcsAtom)
  const setIsShowSideBar = useSetAtom(isShowSideBarAtom)
  const setUser = useSetAtom(userAtom)
  const setAuthStatus = useSetAtom(authStatusAtom)
  // HomePage 的重挂钥匙：只有真正换账号才会变。
  // 用 user.email 当 key 会让「刷新时 null → 已登录」这次必然发生的变化白送一次全量重挂
  const [sessionKey, setSessionKey] = useState('session')

  useEffect(() => {
    setIsShowSideBar(!isMobile)
  }, [isMobile, setIsShowSideBar])

  useEffect(() => {
    switch (location.pathname) {
      case config.paths.login:
        resetAllAtoms()
        break
      case config.paths.home:
        apiAuthToken().then((data) => {
          const prev = store.get(userAtom)
          // 首次解析时 prev.email 为空，不算换账号；换账号才需要清掉上一个账号的残留并重挂
          const switched = !!prev?.email && !!data.email && prev.email !== data.email

          if (switched) {
            resetAllAtoms()
            setSessionKey(data.email)
          }

          setUser(data)
          setAuthStatus(data.isLogin ? 'authed' : 'guest')
        })
        break
    }
  }, [location])

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path={config.paths.login} element={<LoginPage key="login" />} />
          <Route path={config.paths.home} element={<HomePage key={sessionKey} />} />
        </Routes>
      </Suspense>

      <CToast toasts={toasts} onClose={dismissToast} />

      <CModal
        open={dialog.visible}
        children={dialog.children}
        disableClose={dialog.disableClose}
        onClose={() => {
          switchDialog({ visible: false, children: null })
          dialog.onClose && dialog.onClose()
        }}
      />

      <CAnchor
        children={anchor.children}
        config={anchor.config}
        onClose={() => switchAnchor({ children: null })}
      />

      <ImagePreview srcs={imagePreviewSrcs} />
    </>
  )
}

export default RoutesComponent
