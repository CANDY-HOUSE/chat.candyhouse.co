import { getLocalValue, localKey } from '@/utils'
import { config } from '@config'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { languageEn } from './LanguageEn'
import { languageJa } from './LanguageJp'
import { languageZh } from './LanguageZh'
import { languageZhTw } from './LanguageZhTw'

i18n.use(initReactI18next).init({
  resources: {
    ja: { translation: languageJa },
    en: { translation: languageEn },
    zh: { translation: languageZh },
    zhTw: { translation: languageZhTw }
  },
  lng: getLocalValue<string>(localKey.language) || config.defaultLanguage,
  fallbackLng: 'ja',
  interpolation: { escapeValue: false }
})

export default i18n
