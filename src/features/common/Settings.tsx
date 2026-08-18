import { DataList } from '@/components/DataList'
import { useMediaQueryContext } from '@/context/MediaQueryContext'
import { useConversation } from '@/hooks/useConversation'
import { switchAnchor, switchDialog, switchToast, userAtom } from '@/store'
import { IModelInfo } from '@/types/messagetypes'
import { apiConversationsUpdate } from '@api'
import { Level } from '@constants'
import CleaningServicesIcon from '@mui/icons-material/CleaningServices'
import DeleteIcon from '@mui/icons-material/Delete'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import SettingsIcon from '@mui/icons-material/Settings'
import { IconButton } from '@mui/material'
import { enhanceEventParams } from '@utils'
import { useAtomValue } from 'jotai'
import { isEqual } from 'lodash-es'
import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import ModelSettingDialog from '../dialog/ModelSettingDialog'

interface Props {
  conversationId: string
  isVertical: boolean
  style?: React.CSSProperties
}

const Settings: React.FC<Props> = ({ conversationId, isVertical, style }) => {
  const { isMobile } = useMediaQueryContext()
  const { t } = useTranslation()
  const user = useAtomValue(userAtom)
  const { getAttrValue, updateModelInfo, deleteMessage, deleteConversation } = useConversation()
  const modelName = getAttrValue(conversationId, 'modelInfo')?.modelName ?? ''
  // 打开弹窗时才取基线快照。React.memo(Settings) + 非响应式 store.get 会把渲染期读到的
  // modelInfo 冻结在首次挂载，导致 isEqual 基线陈旧、关闭弹窗时把 useAi 写入的
  // modelName/atWork 回滚——这两个 ref 必须在 set 的 handle() 里（每次打开）重新赋值。
  const originValuesRef = useRef<Partial<IModelInfo>>({})
  const valuesRef = useRef<Partial<IModelInfo>>({})

  const actionsData = [
    {
      text: t('set'),
      icon: (
        <SettingsIcon
          sx={{
            fontSize: 'var(--icon-size-small)'
          }}
        />
      ),
      handle(id: string) {
        const current = (getAttrValue(id, 'modelInfo') ?? {}) as IModelInfo & {
          tools?: unknown
          options?: unknown
        }
        const { tools, options, ...snapshot } = current
        originValuesRef.current = { ...snapshot }
        valuesRef.current = { ...snapshot }

        const changeCache = (data: Partial<IModelInfo>) => {
          valuesRef.current = { ...valuesRef.current, ...data }
        }

        switchDialog({
          children: <ModelSettingDialog conversationId={id} changeCache={changeCache} />,
          visible: true,
          onClose: handleUpdate
        })
        switchAnchor({ children: null })
      }
    },
    {
      text: t('DeleteChatHistory'),
      icon: (
        <CleaningServicesIcon
          sx={{
            fontSize: 'var(--icon-size-small)'
          }}
        />
      ),
      handle(id: string) {
        deleteMessage(id)
        switchAnchor({ children: null })

        gtag(
          'event',
          'model_management',
          enhanceEventParams({
            action_type: 'clear_history',
            model_name: modelName
          })
        )
      }
    },
    {
      text: t('delCurChat'),
      icon: (
        <DeleteIcon
          sx={{
            fontSize: 'var(--icon-size-small)'
          }}
        />
      ),
      handle(id: string) {
        deleteConversation(id)
        switchAnchor({ children: null })

        gtag(
          'event',
          'model_management',
          enhanceEventParams({
            action_type: 'remove',
            model_name: modelName
          })
        )
      }
    }
  ]

  const handleUpdate = async () => {
    if (!isEqual(valuesRef.current, originValuesRef.current)) {
      const { jsonConfigRaw, atWork, disable, ...mI } = valuesRef.current
      let success = true

      if (user?.isLogin) {
        success = await apiConversationsUpdate({
          id: conversationId,
          modelInfo: mI
        })
      }

      if (success) {
        updateModelInfo(conversationId, mI)
        originValuesRef.current = { ...mI }
      } else {
        switchToast({ visible: true, message: t('SubmissionFail'), level: Level.error })
      }
    }
  }

  const clickMore = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()

    switchAnchor({
      children: <DataList id={conversationId} actions={actionsData} />,
      config: {
        top: rect.bottom,
        left: rect.left,
        origin: isMobile ? e.currentTarget : undefined
      }
    })
  }

  return (
    <IconButton sx={{ flex: 'none' }} style={style} onClick={clickMore}>
      {isVertical ? (
        <MoreVertIcon sx={{ fontSize: 'var(--icon-size-small)' }} />
      ) : (
        <MoreHorizIcon sx={{ fontSize: 'var(--icon-size-small)' }} />
      )}
    </IconButton>
  )
}
export default React.memo(Settings)
