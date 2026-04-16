import { apiGetModelSelect } from '@/api'
import { MediaQueryProvider } from '@/context/MediaQueryContext'
import { globalStyles } from '@/styles/globalStyle'
import { config } from '@config'
import { GlobalStyles, ThemeProvider } from '@mui/material'
import CssBaseline from '@mui/material/CssBaseline'
import { Amplify } from 'aws-amplify'
import hotkeys from 'hotkeys-js'
import { Provider as JotaiProvider, useAtomValue, useSetAtom } from 'jotai'
import type { FC, JSX } from 'react'
import { useEffect } from 'react'
import { I18nextProvider } from 'react-i18next'
import { BrowserRouter as Router } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import { MessageListProvider } from './context/MessageListContext'
import i18n from './i18n'
import RoutesComponent from './router/RoutesComponent'
import { fontSizeAtom, languageAtom, modelSelectAtom, store, themeAtom } from './store'

Amplify.configure({
  aws_user_files_s3_bucket: config.s3Config.aws_user_files_s3_bucket,
  aws_user_files_s3_bucket_region: config.s3Config.aws_user_files_s3_bucket_region,
  Auth: {
    region: process.env.REACT_APP_API_REGION,
    userPoolId: process.env.REACT_APP_USER_POOL_ID,
    userPoolWebClientId: process.env.REACT_APP_USER_POOL_WEB_CLIENT_ID,
    identityPoolId: process.env.REACT_APP_IDENTITY_POOL_ID,
    mandatorySignIn: false
  },
  API: {
    endpoints: [
      {
        region: process.env.REACT_APP_API_REGION,
        name: process.env.REACT_APP_API_NAME,
        endpoint: process.env.REACT_APP_API_ENDPOINT
      }
    ]
  }
})

const AppContent: FC = (): JSX.Element => {
  const atomTheme = useAtomValue(themeAtom)
  const fontSize = useAtomValue(fontSizeAtom)
  const language = useAtomValue(languageAtom)
  const setModelSelect = useSetAtom(modelSelectAtom)

  // 响应字体变化
  useEffect(() => {
    // 移除所有字体大小类
    document.body.classList.remove(
      'font-size-14',
      'font-size-16',
      'font-size-18',
      'font-size-21',
      'font-size-24',
      'font-size-28'
    )

    // 添加保存的字体大小类
    document.body.classList.add(`font-size-${fontSize}`)
  }, [fontSize])

  // 响应语言变化
  useEffect(() => {
    document.documentElement.classList.remove('lang-ja', 'lang-zh', 'lang-zhTw', 'lang-en')
    document.documentElement.classList.add(`lang-${language}`)
  }, [language])

  // 初始化
  useEffect(() => {
    const initModelSelect = async () => {
      const res = await apiGetModelSelect('all', { sortOrder: 'asc' })
      const models = res?.items
      if (models) {
        setModelSelect(models)
      }
    }
    initModelSelect()
  }, [setModelSelect])

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={atomTheme}>
        <MediaQueryProvider>
          <CssBaseline />
          <GlobalStyles styles={globalStyles} />
          <MessageListProvider>
            <Router
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true
              }}
            >
              <RoutesComponent />
            </Router>
          </MessageListProvider>
        </MediaQueryProvider>
      </ThemeProvider>
    </I18nextProvider>
  )
}

const App: FC = (): JSX.Element => {
  return (
    <ErrorBoundary>
      <JotaiProvider store={store}>
        <AppContent />
      </JotaiProvider>
    </ErrorBoundary>
  )
}

export default App

hotkeys.filter = (event) => {
  const target = event.target as HTMLElement
  if (!target) return true
  // 仅屏蔽输入框，放行 contenteditable
  return !(target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
}
