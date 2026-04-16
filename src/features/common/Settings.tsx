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
  const { tools, options, ...modelInfo } = getAttrValue(
    conversationId,
    'modelInfo'
  ) as IModelInfo & { tools?: unknown; options?: unknown }
  let originValues = { ...modelInfo }
  const valuesRef = useRef({ ...modelInfo })

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
        const changeCache = (data: Record<string, unknown>) => {
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
            model_name: modelInfo.modelName
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
            model_name: modelInfo.modelName
          })
        )
      }
    }
  ]

  const handleUpdate = async () => {
    if (!isEqual(valuesRef.current, originValues)) {
      let success = true

      if (user?.isLogin) {
        success = await apiConversationsUpdate({
          id: conversationId,
          modelInfo: valuesRef.current
        })
      }

      if (success) {
        updateModelInfo(conversationId, valuesRef.current)
        originValues = { ...valuesRef.current }
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
