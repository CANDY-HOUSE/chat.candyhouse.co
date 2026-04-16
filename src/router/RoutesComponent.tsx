import { CAnchor } from '@/components/CAnchor'
import { CModal } from '@/components/CModal'
import { CToast } from '@/components/CToast'
import { PageLoader } from '@/components/PageLoader'
import { useMediaQueryContext } from '@/context/MediaQueryContext'
import {
  anchorAtom,
  dialogAtom,
  imagePreviewSrcsAtom,
  isShowSideBarAtom,
  resetAllAtoms,
  switchAnchor,
  switchDialog,
  switchToast,
  toastAtom,
  userAtom
} from '@/store'
import { apiAuthToken } from '@api'
import { config } from '@config'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import React, { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import ImagePreview from '../features/common/ImagePreview'

const HomePage = lazy(() => import('../pages/home'))
const LoginPage = lazy(() => import('../pages/login'))

const RoutesComponent: React.FC = () => {
  const { isMobile } = useMediaQueryContext()
  const location = useLocation()
  const toast = useAtomValue(toastAtom)
  const anchor = useAtomValue(anchorAtom)
  const dialog = useAtomValue(dialogAtom)
  const imagePreviewSrcs = useAtomValue(imagePreviewSrcsAtom)
  const setIsShowSideBar = useSetAtom(isShowSideBarAtom)
  const [user, setUser] = useAtom(userAtom)

  useEffect(() => {
    setIsShowSideBar(!isMobile)
  }, [isMobile, setIsShowSideBar])

  useEffect(() => {
    switch (location.pathname) {
      case config.paths.login:
        resetAllAtoms()
        break
      case config.paths.home:
        apiAuthToken().then(async (data) => {
          setUser(data)
        })
        break
    }
  }, [location])

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path={config.paths.login} element={<LoginPage key="login" />} />
          <Route path={config.paths.home} element={<HomePage key={user?.email || 'no-user'} />} />
        </Routes>
      </Suspense>

      <CToast
        open={toast.visible}
        message={toast.message || ''}
        onClose={() => switchToast({ visible: false, message: '' })}
      />

      <CModal
        open={dialog.visible}
        children={dialog.children}
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
