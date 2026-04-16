import { DataList } from '@/components/DataList'
import { TooltipButton } from '@/components/TooltipButton'
import { useMediaQueryContext } from '@/context/MediaQueryContext'
import SettingDialog from '@/features/dialog/SettingDialog'
import { useCommandK } from '@/hooks/useCommandK'
import { useConversation } from '@/hooks/useConversation'
import {
  activeModelSelectAtom,
  activeTopicIdAtom,
  isShowSideBarAtom,
  sideBarWidthAtom,
  switchDialog,
  switchToast,
  topicsAtom,
  UI_CONSTANTS,
  userAtom,
  versionInfo
} from '@/store'
import { chat, localKey, putLocalValue } from '@/utils'
import { apiConversationsGet, apiTopicsCreate, apiTopicsGet } from '@api'
import { icons } from '@assets/icons'
import { Level } from '@constants'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import SearchIcon from '@mui/icons-material/Search'
import SettingsIcon from '@mui/icons-material/Settings'
import { Box, Stack } from '@mui/material'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Personal } from './Personal'
import SearchInput from './SearchInput'
import TopicList, { type TopicListRef } from './TopicList'

const Sidebar = () => {
  const { t } = useTranslation()
  const { isMobile } = useMediaQueryContext()
  const activeModelSelect = useAtomValue(activeModelSelectAtom)
  const isShowSideBar = useAtomValue(isShowSideBarAtom)
  const sideBarW = useAtomValue(sideBarWidthAtom)
  const version = useAtomValue(versionInfo)
  const user = useAtomValue(userAtom)
  const [topics, setTopics] = useAtom(topicsAtom)
  const setActiveTopicId = useSetAtom(activeTopicIdAtom)
  const { setConversations } = useConversation()
  const [loading, setLoading] = useState(true)
  const sideBarWidth = isMobile ? UI_CONSTANTS.mobileSideBarWidth : sideBarW

  const topicListRef = useRef<TopicListRef>(null)

  const newChatDisabled = useMemo(() => {
    return !user?.isLogin && topics.length >= 1
  }, [topics, user?.isLogin])

  const actionsData = [
    {
      text: user?.isLogin ? user.email : t('notlogged'),
      secondary: user?.isMembership ? '' : 'Free',
      handle() {
        switchDialog({ children: <Personal />, visible: true })
      }
    },
    {
      text: `${version?.buildTime} ${version?.gitHash}`,
      disabled: true
    }
  ]

  // 绑定 command+k 快捷键
  useCommandK(() => {
    startTransition(() => {
      switchDialog({
        children: <SearchInput topicListRef={topicListRef.current} />,
        visible: true
      })
    })
  })

  // 获取话题
  const getTopicList = async () => {
    const list = await apiTopicsGet()
    setTopics(list)

    if (list.length === 0) {
      handleCreateTopic()
    } else {
      setLoading(false)

      // 初始化 gtag user_id
      const uuid = list[0]!.subUUID
      putLocalValue(localKey.uuid, uuid)
      gtag('set', {
        user_id: uuid
      })
    }
  }

  // 创建话题
  const handleCreateTopic = async () => {
    if (newChatDisabled) return
    const topicName = t('topicCaption')
    let success = true

    if (user?.isLogin) {
      success = await apiTopicsCreate(topicName)
      const list = await apiTopicsGet()
      const topicId = list[0]!.id
      const convs = await apiConversationsGet(topicId)

      setActiveTopicId(topicId)
      setTopics(list)
      setConversations(convs)
    } else {
      const topicTmpId = 'test-tid'
      const topicTmpData = {
        id: topicTmpId,
        name: topicName,
        models: [] as string[]
      }
      const convsTmpData = activeModelSelect.map((model) => {
        const conv = chat.createTplConv(topicTmpId, model.modelName)
        model.isDefault && topicTmpData.models.push(conv.modelId)
        conv.modelInfo = model

        return conv
      })

      setActiveTopicId(topicTmpId)
      setTopics([topicTmpData, ...topics])
      setConversations(convsTmpData)
    }

    if (!success) {
      switchToast({ visible: true, message: t('createFail'), level: Level.error })
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!activeModelSelect || activeModelSelect.length < 1) return

    if (user?.isLogin) {
      getTopicList()
    } else {
      handleCreateTopic()
    }
  }, [user?.isLogin, activeModelSelect])

  return (
    <Stack
      sx={{
        overflow: 'hidden',
        transition: 'width 225ms cubic-bezier(0, 0, 0.2, 1)',
        width: `${isShowSideBar ? sideBarWidth : 0}px`,
        flex: 'none',
        background: 'var(--color-background)'
      }}
      direction="column"
      alignItems="stretch"
      justifyContent="space-between"
    >
      {/* logo */}
      <Stack
        sx={{
          position: 'relative',
          p: 'var(--spacing-sm)'
        }}
        direction="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <a
          href="https://jp.candyhouse.co/"
          target="_blank"
          rel="noreferrer noopener"
          style={{ display: 'inline-block' }}
        >
          <img
            src={icons.candyhouseLogo}
            alt="CANDY HOUSE Icon"
            style={{
              width: '1.6rem',
              objectFit: 'contain'
            }}
          />
        </a>

        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ flex: 'none', cursor: 'pointer' }}
          onClick={() =>
            switchDialog({
              children: <SearchInput topicListRef={topicListRef.current} />,
              visible: true
            })
          }
        >
          <SearchIcon sx={{ color: 'var(--text-secondary)', fontSize: 'var(--icon-size)' }} />
          <Box
            sx={{
              bgcolor: '#fff',
              p: '2px 4px',
              border: '1px solid var(--text-secondary)',
              borderRadius: '6px',
              lineHeight: 1,
              color: 'var(--text-secondary)'
            }}
          >
            ⌘ K
          </Box>
        </Stack>
      </Stack>

      {/* topics */}
      <Box
        className="none-scrollbar"
        sx={{
          flex: 'auto',
          overflowX: 'hidden',
          overflowY: 'auto',
          bgcolor: 'var(--grey-50)'
        }}
      >
        <TopicList ref={topicListRef} loading={loading} />
      </Box>

      {/* actions */}
      <Box sx={{ flex: 'none' }}>
        <DataList
          actions={actionsData}
          disablePadding={isMobile}
          sx={{ '& > li:first-of-type': { pl: 'calc(var(--spacing-sm) - 8px)' } }}
        >
          <Stack direction="row" justifyContent="flex-start" sx={{ width: '100%' }}>
            <TooltipButton
              onClick={handleCreateTopic}
              disabled={newChatDisabled}
              tooltip={t('createTopic')}
              icon={<AddCircleOutlineIcon sx={{ fontSize: 'var(--icon-size-small)' }} />}
            ></TooltipButton>
            <TooltipButton
              onClick={() => switchDialog({ children: <SettingDialog />, visible: true })}
              tooltip={t('set')}
              icon={<SettingsIcon sx={{ fontSize: 'var(--icon-size-small)' }} />}
            ></TooltipButton>
          </Stack>
        </DataList>
      </Box>
    </Stack>
  )
}

export default React.memo(Sidebar)
