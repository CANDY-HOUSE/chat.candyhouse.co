import { DataList } from '@/components/DataList'
import { TooltipButton } from '@/components/TooltipButton'
import { useMediaQueryContext } from '@/context/MediaQueryContext'
import SettingDialog from '@/features/dialog/SettingDialog'
import { useCommandK } from '@/hooks/useCommandK'
import { useConversation } from '@/hooks/useConversation'
import { useModel } from '@/hooks/useModel'
import { useOptimistic } from '@/hooks/useOptimistic'
import {
  activeModelSelectAtom,
  activeTopicIdAtom,
  BeanTheme,
  changeTheme,
  gateTopicReady,
  isShowSideBarAtom,
  mThemeValueAtom,
  previewModelSelectAtom,
  sideBarWidthAtom,
  store,
  switchDialog,
  switchToast,
  topicsAtom,
  UI_CONSTANTS,
  userAtom,
  versionInfo
} from '@/store'
import { chat, localKey, putLocalValue, utils } from '@/utils'
import { apiConversationsGet, apiTopicsCreate, apiTopicsGet } from '@api'
import { icons } from '@assets/icons'
import { Level, ModelCategory } from '@constants'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import SearchIcon from '@mui/icons-material/Search'
import SettingsIcon from '@mui/icons-material/Settings'
import UpdateIcon from '@mui/icons-material/Update'
import { Box, IconButton, Menu, MenuItem, Stack, Typography } from '@mui/material'
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
  const themeMode = useAtomValue(mThemeValueAtom)
  const isShowSideBar = useAtomValue(isShowSideBarAtom)
  const sideBarW = useAtomValue(sideBarWidthAtom)
  const version = useAtomValue(versionInfo)
  const user = useAtomValue(userAtom)
  const previewModelSelect = useAtomValue(previewModelSelectAtom)
  const [topics, setTopics] = useAtom(topicsAtom)
  const setActiveTopicId = useSetAtom(activeTopicIdAtom)
  const { setConversations, resetConversations } = useConversation()
  const { runOptimistic } = useOptimistic()
  const { promoteModel } = useModel()
  const [loading, setLoading] = useState(true)
  const [promoteLoading, setPromoteLoading] = useState(false)
  const sideBarWidth = isMobile ? UI_CONSTANTS.mobileSideBarWidth : sideBarW

  const topicListRef = useRef<TopicListRef>(null)
  const newTopicAnchorRef = useRef<HTMLDivElement>(null)
  const [newTopicMenuOpen, setNewTopicMenuOpen] = useState(false)

  const newTopicCategoryOptions: Array<{ label: string; value: ModelCategory | 'all' }> = [
    { label: t('modelCategory.all'), value: 'all' },
    // AUDIO 暂未接入相关模型，先屏蔽该选项
    ...Object.values(ModelCategory)
      .filter((category) => category !== ModelCategory.AUDIO)
      .map((category) => ({
        label: t(`modelCategory.${category}`),
        value: category
      }))
  ]

  const newChatDisabled = useMemo(() => {
    return !user?.isLogin && topics.length >= 1
  }, [topics, user?.isLogin])
  const promoteInfo = useMemo(() => {
    if (previewModelSelect.length < 1) return null

    return (
      <React.Fragment>
        <Typography variant="body1">{t('model.promote')}：</Typography>
        {previewModelSelect.map((model) => (
          <Typography variant="body2" key={model.modelName}>
            {model.modelName}
          </Typography>
        ))}
      </React.Fragment>
    )
  }, [previewModelSelect, t])

  const actionsData = [
    {
      text: user?.isLogin ? user.email : t('notlogged'),
      secondary: user?.isMembership ? '' : 'Free',
      handle() {
        switchDialog({ children: <Personal />, visible: true })
      }
    },
    {
      text: `${version?.buildTime} ${version?.gitHash}${version?.baseHash ? ` - ${version.baseHash}` : ''}`,
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

  // 构建本地占位会话（未登录、以及登录用户乐观渲染共用）
  const buildTmpConversations = (topicId: string, category: ModelCategory | 'all') => {
    const models: string[] = []
    const convs = activeModelSelect
      .filter((model) => category === 'all' || model.category === category)
      .map((model) => {
        const conv = chat.createTplConv(topicId, model.modelName)
        if (model.isDefault) models.push(conv.modelId)
        conv.modelInfo = model

        return conv
      })

    return { convs, models }
  }

  // 创建话题
  const handleCreateTopic = async (category: ModelCategory | 'all' = 'all') => {
    if (newChatDisabled) return
    const topicName = category === 'all' ? t('topicCaption') : t(`modelCategory.${category}`)

    if (!user?.isLogin) {
      const topicTmpId = 'tmp-tid'
      const { convs, models } = buildTmpConversations(topicTmpId, category)

      setConversations(convs, topicTmpId)
      setTopics((prev) => [{ id: topicTmpId, name: topicName, models }, ...prev])
      setActiveTopicId(topicTmpId)
      setLoading(false)
      return
    }

    // 乐观渲染：本地占位话题/会话先即时上屏，后端落库完成后再换成真实数据
    const prevActiveTopicId = store.get(activeTopicIdAtom)
    const tmpId = `tmp-${utils.getUUID()}`
    const { convs: tmpConvs, models } = buildTmpConversations(tmpId, category)

    await gateTopicReady(
      runOptimistic({
        apply: () => {
          setConversations(tmpConvs, tmpId)
          setTopics((prev) => [{ id: tmpId, name: topicName, models }, ...prev])
          setActiveTopicId(tmpId)
          setLoading(false)
        },
        commit: () => apiTopicsCreate(topicName, category),
        reconcile: async (created) => {
          // 话题要后端生成的 order/version，会话要真实 conversationId，互不依赖可并行
          const [list, convs] = await Promise.all([apiTopicsGet(), apiConversationsGet(created.id)])

          setConversations(convs, created.id)
          setTopics(list)
          // 仅当用户还停在这个新话题上才切过去，避免抢走这期间手动选中的话题
          if (store.get(activeTopicIdAtom) === tmpId) setActiveTopicId(created.id)
          resetConversations(tmpId)
        },
        // 摘掉占位话题并退回创建前选中的话题
        rollback: () => {
          setTopics((prev) => prev.filter((topic) => topic.id !== tmpId))
          resetConversations(tmpId)
          if (store.get(activeTopicIdAtom) === tmpId) setActiveTopicId(prevActiveTopicId)
        },
        failMessage: t('createFail')
      })
    )
  }

  // 切换深色/浅色模式
  const handleToggleTheme = () => {
    changeTheme(themeMode === BeanTheme.dark ? BeanTheme.light : BeanTheme.dark)
  }

  // 升级模型
  const handlePromoteModel = async () => {
    if (!user?.isLogin || promoteLoading) return

    setPromoteLoading(true)
    const result = await promoteModel()
    if (result) {
      switchToast({ visible: true, message: t('common.upgradeSuccess'), level: Level.success })
    } else {
      switchToast({ visible: true, message: t('common.upgradeFailed'), level: Level.error })
    }
    setPromoteLoading(false)
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
        background: 'var(--surface-canvas)'
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
              bgcolor: 'var(--surface-raised)',
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
          bgcolor: 'var(--surface-content)'
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
            <Box ref={newTopicAnchorRef} sx={{ display: 'inline-flex' }}>
              <TooltipButton
                onClick={() => setNewTopicMenuOpen(true)}
                disabled={newChatDisabled}
                tooltip={t('createTopic')}
                icon={<AddCircleOutlineIcon sx={{ fontSize: 'var(--icon-size-small)' }} />}
              ></TooltipButton>
            </Box>
            <Menu
              anchorEl={newTopicAnchorRef.current}
              open={newTopicMenuOpen}
              onClose={() => setNewTopicMenuOpen(false)}
            >
              {newTopicCategoryOptions.map((option) => (
                <MenuItem
                  key={option.value}
                  onClick={() => {
                    setNewTopicMenuOpen(false)
                    handleCreateTopic(option.value)
                  }}
                >
                  {option.label}
                </MenuItem>
              ))}
            </Menu>
            <TooltipButton
              onClick={() => switchDialog({ children: <SettingDialog />, visible: true })}
              tooltip={t('set')}
              icon={<SettingsIcon sx={{ fontSize: 'var(--icon-size-small)' }} />}
            ></TooltipButton>
            <IconButton onClick={handleToggleTheme} sx={{ color: 'inherit' }}>
              {themeMode === BeanTheme.dark ? (
                <LightModeOutlinedIcon sx={{ fontSize: 'var(--icon-size-small)' }} />
              ) : (
                <DarkModeOutlinedIcon sx={{ fontSize: 'var(--icon-size-small)' }} />
              )}
            </IconButton>
            {user?.isLogin && promoteInfo && (
              <TooltipButton
                loading={promoteLoading}
                disabled={previewModelSelect.length < 1}
                tooltip={promoteInfo}
                onClick={handlePromoteModel}
                icon={<UpdateIcon sx={{ fontSize: 'var(--icon-size-small)' }} />}
              ></TooltipButton>
            )}
          </Stack>
        </DataList>
      </Box>
    </Stack>
  )
}

export default React.memo(Sidebar)
