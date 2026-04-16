import {
  apiConversationMove,
  apiConversationsCreate,
  apiConversationsGet,
  apiMessagesGet,
  apiTopicMove,
  apiTopicsDelete,
  apiTopicsGet,
  apiTopicsUpdate
} from '@/api'
import { DataList } from '@/components/DataList'
import { MenuButton, type OptionType } from '@/components/MenuButton'
import { useMediaQueryContext } from '@/context/MediaQueryContext'
import { DragList, type ReorderInfo } from '@/features/common/DragList'
import { useConversation } from '@/hooks/useConversation'
import { useTopic } from '@/hooks/useTopic'
import {
  activeModelSelectAtom,
  activeTopicIdAtom,
  conversationsAtom,
  focusMessageAtom,
  switchAnchor,
  switchToast,
  topicsAtom,
  userAtom
} from '@/store'
import type { IConversation, ITopics } from '@/types/messagetypes'
import { chat, enhanceEventParams, logger } from '@/utils'
import { Level } from '@constants'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Done as DoneIcon,
  Edit as EditIcon,
  MoreHoriz as MoreHorizIcon
} from '@mui/icons-material'
import {
  Checkbox,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Stack,
  TextField
} from '@mui/material'
import { useAtom, useAtomValue } from 'jotai'
import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  loading?: boolean
}

export interface TopicListRef {
  selectModel: (topicId: string, modelId: string, anchorTimestamp?: string) => void
  clickTopic: (id: string, models: string[], anchorTimestamp?: string) => void
}

const TopicList = React.forwardRef<TopicListRef, Props>(({ loading = true }, ref) => {
  const { t } = useTranslation()
  const { isMobile } = useMediaQueryContext()
  const user = useAtomValue(userAtom)
  const activeModelSelect = useAtomValue(activeModelSelectAtom)
  const [topics, setTopics] = useAtom(topicsAtom)
  const conversations = useAtomValue(conversationsAtom)
  const [activeTopicId, setActiveTopicId] = useAtom(activeTopicIdAtom)
  const [focusMessage, setFocusMessage] = useAtom(focusMessageAtom)
  const [editId, setEditId] = useState<string>() // 当前编辑的话题
  const [loadingState, setLoading] = useState(true)

  const { resetConversations, getConversations, setConversations, updateAttrsValue } =
    useConversation()
  const { updateAttrsValue: updateTopicAttrsValue } = useTopic()

  const inputRef = useRef<HTMLInputElement>(null)

  const modelsOptions: OptionType[] = useMemo(() => {
    return activeModelSelect.map((model) => ({
      label: model.modelName,
      value: model.modelName
    }))
  }, [activeModelSelect])

  const actionsData = [
    {
      text: t('delete'),
      icon: (
        <DeleteIcon
          sx={{
            fontSize: 'var(--icon-size-small)'
          }}
        />
      ),
      async handle(topicId: string) {
        const originList = [...topics]
        let list = [...topics]
        const index = list.findIndex((t) => t.id === topicId)
        let success = true

        switchAnchor({ children: null })
        list = list.toSpliced(index, 1)
        setTopics(list)

        if (user?.isLogin) {
          success = await apiTopicsDelete(topicId)
        }

        if (topicId === activeTopicId) {
          if (list.length > 0) {
            handleTopicClick(list[0]!.id, list[0]!.models)
          } else {
            setActiveTopicId('')
          }
        }

        if (!success) {
          setTopics(originList)
          switchToast({ visible: true, message: t('DelFail'), level: Level.error })
        }
      }
    },
    {
      text: t('edit'),
      icon: (
        <EditIcon
          sx={{
            fontSize: 'var(--icon-size-small)'
          }}
        />
      ),
      handle(topicId: string) {
        setEditId(topicId)
        switchAnchor({ children: null })
      }
    }
  ]

  // 话题标题组件
  const topicCaption = (id: string, text: string) => {
    if (id === editId)
      return (
        <TextField
          inputRef={inputRef}
          fullWidth
          variant="outlined"
          size="small"
          defaultValue={text}
          onClick={(e) => e.stopPropagation()}
          sx={{ m: 0 }}
          slotProps={{
            htmlInput: {
              maxLength: 16
            }
          }}
        />
      )

    return text
  }

  // 获取话题列表
  const getTopicList = async () => {
    const list = await apiTopicsGet()
    setTopics(list)

    return list
  }

  // 初始化会话消息列表
  const conversationMessagesInit = async (
    model: string[] | string,
    convs: IConversation[],
    anchorTimestamp?: string
  ) => {
    const modelIds = Array.isArray(model) ? model : model ? [model] : []
    const targetConvs = convs.filter((item) => modelIds.includes(item.modelId))

    // 并行请求所有会话消息
    const fetchPromises = targetConvs
      .filter((item) => item.messages?.length === 0 || anchorTimestamp)
      .map(async (item) => {
        const param: {
          id: string
          limit?: number
          preAnchorTimestamp?: string
          nextAnchorTimestamp?: string
        } = { id: item.conversationId }

        if (anchorTimestamp) {
          param.limit = 5
          param.preAnchorTimestamp = anchorTimestamp
          param.nextAnchorTimestamp = anchorTimestamp
        }

        const res = await apiMessagesGet(param)

        if (res) {
          updateAttrsValue(item.conversationId, {
            messages: res.messages || [],
            nextToken: res.nextToken
          })
        }
      })

    await Promise.all(fetchPromises)
  }

  // 话题 展开/收起
  const handleTopicClick = async (id: string, models: string[], anchorTimestamp?: string) => {
    if (id === activeTopicId && !anchorTimestamp) return
    if (!anchorTimestamp && focusMessage) {
      updateAttrsValue(
        focusMessage.conversationId,
        {
          messages: [],
          nextToken: null
        },
        activeTopicId!
      )
      setFocusMessage(null)
    }
    setActiveTopicId(id)
    setEditId('')

    if (user?.isLogin) {
      let convs = getConversations(id)

      if (!convs || convs.length === 0) {
        convs = await apiConversationsGet(id)
        setConversations(convs)
      }

      await conversationMessagesInit(models, convs, anchorTimestamp)
    } else {
      resetConversations(id)
    }
  }

  // 模型会话勾选
  const handleModelSelect = async (id: string, model: string, anchorTimestamp?: string) => {
    const t = [...topics]
    const tIndex = t.findIndex((item) => item.id === id)

    const finalModels = [...t[tIndex]!.models]
    const mIndex = finalModels.indexOf(model)
    const isCheck = mIndex < 0 // 模型是否勾选

    if (isCheck) {
      // 模型勾选
      finalModels.push(model)
    } else {
      if (anchorTimestamp) return
      // 取消模型勾选
      finalModels.splice(mIndex, 1)
    }

    // 更新 topics
    t[tIndex]!.models = finalModels
    setTopics(t)

    if (user?.isLogin) {
      // 话题所属模型变更
      await apiTopicsUpdate({ id, models: finalModels })
      if (anchorTimestamp) return

      // 更新消息列表
      if (isCheck) {
        const convs = getConversations(id)
        convs && (await conversationMessagesInit(model, convs))
      }
    }
  }

  // ‘更多’操作按钮点击
  const handleActionClick = async (e: React.MouseEvent<HTMLElement>, topicId: string) => {
    e.stopPropagation()

    if (editId === topicId) {
      // 提交修改
      const list = [...topics]
      const index = list.findIndex((t) => t.id === topicId)
      const originName = list[index]?.name
      const name = inputRef.current?.value

      setEditId('')

      if (!name || originName === name) {
        return
      }

      let success = true
      list[index]!.name = name
      setTopics(list)

      if (user?.isLogin) {
        success = await apiTopicsUpdate({ id: topicId, name })
        getTopicList()
      }

      if (!success) {
        switchToast({ visible: true, message: t('SubmissionFail'), level: Level.error })
      }
    } else {
      // 打开操作菜单
      const rect = e.currentTarget.getBoundingClientRect()

      switchAnchor({
        children: <DataList id={topicId} actions={actionsData} />,
        config: {
          top: rect.bottom,
          left: rect.left
        }
      })
    }
  }

  // 根据新数组计算 before/after
  function getNeighbors<T>(arr: T[], index: number) {
    return {
      before: arr[index - 1] || null,
      after: arr[index + 1] || null
    }
  }

  // 会话排序
  const handleConvSort = async (
    data: IConversation[],
    { newIndex, item, items }: ReorderInfo<IConversation>,
    models: string[]
  ) => {
    const { before, after } = getNeighbors<IConversation>(data, newIndex)
    const { topicId, modelId, version, conversationId } = item

    // 乐观更新
    setConversations(data)

    if (user?.isLogin) {
      const res = await apiConversationMove(topicId, {
        targetModelId: modelId,
        beforeModelId: before?.modelId,
        afterModelId: after?.modelId,
        expectedVersion: version ?? 0
      })

      if (res) {
        updateAttrsValue(conversationId, { order: res.order, version: res.version })
      } else {
        // 回滚 & 刷新
        setConversations(items)
        const latest = await apiConversationsGet(topicId)
        setConversations(latest)
        conversationMessagesInit(models, latest)
      }
    }
  }

  // 话题排序
  const handleTopicSort = async (
    data: ITopics[],
    { newIndex, item, items }: ReorderInfo<ITopics>
  ) => {
    const { before, after } = getNeighbors<ITopics>(data, newIndex)

    // 乐观更新
    setTopics(data)

    if (user?.isLogin) {
      const res = await apiTopicMove({
        targetTopicId: item.id,
        beforeTopicId: before?.id,
        afterTopicId: after?.id,
        expectedVersion: item.version ?? 0
      })

      if (res) {
        updateTopicAttrsValue(item.id, { order: res.order, version: res.version })
      } else {
        // 回滚 & 刷新
        setTopics(items)
        const latest = await apiTopicsGet()
        setTopics(latest)
      }
    }
  }

  // 新增会话
  const createConversation = async (data: OptionType) => {
    const topicId = activeTopicId
    if (!topicId) return
    const convTmpData = chat.createTplConv(topicId, data.value)
    const model = activeModelSelect.find((m) => m.modelName === data.value)!
    convTmpData.modelInfo = model
    const originConvs = [...conversations]
    let convs = [convTmpData, ...originConvs]
    let success = true
    setConversations(convs)

    try {
      if (user?.isLogin) {
        success = await apiConversationsCreate({
          topicId,
          modelName: data.value
        })

        if (success) {
          convs = await apiConversationsGet(topicId)
          setConversations([convs[0]!, ...originConvs])
        }
      }

      handleModelSelect(topicId, convs[0]!.modelId)

      if (!success) {
        setConversations(originConvs)
        switchToast({ visible: true, message: t('createFail'), level: Level.error })
      }
    } catch (error) {
      logger.error('Failed to create conversation:', error)
      switchToast({ visible: true, message: t('createFail'), level: Level.error })
    }

    gtag(
      'event',
      'model_management',
      enhanceEventParams({
        action_type: 'add',
        model_name: data.value
      })
    )
  }

  const initPage = async () => {
    if (!loading) {
      if (topics.length > 0) {
        await handleTopicClick(topics[0]!.id, topics[0]!.models)
        setLoading(false)
      }
    }
  }

  useImperativeHandle(ref, () => ({
    selectModel: async (topicId: string, modelId: string, anchorTimestamp?: string) => {
      await handleModelSelect(topicId, modelId, anchorTimestamp)
    },
    clickTopic: async (id: string, models: string[], anchorTimestamp?: string) => {
      await handleTopicClick(id, models, anchorTimestamp)
    }
  }))

  useEffect(() => {
    initPage()
  }, [loading])

  return (
    <List
      sx={{ width: '100%' }}
      component="nav"
      aria-labelledby="nested-list-subheader"
      disablePadding
    >
      {loadingState ? (
        <Stack
          direction="column"
          spacing={2}
          sx={{
            p: '1rem'
          }}
        >
          <Skeleton variant="rounded" height={60} />
          <Skeleton variant="rounded" />
          <Skeleton variant="rounded" />
          <Skeleton variant="rounded" />
          <Skeleton variant="rounded" />
          <Skeleton variant="rounded" />
          <Skeleton variant="rounded" />
          <Skeleton variant="rounded" />
        </Stack>
      ) : (
        <DragList<ITopics>
          items={topics}
          itemId={(value) => value.id}
          onItemsReordered={(data, info) => handleTopicSort(data, info)}
        >
          {(item) => (
            <React.Fragment key={item.id}>
              <ListItem
                disablePadding
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="action"
                    onClick={(e) => handleActionClick(e, item.id)}
                  >
                    {editId === item.id ? (
                      <DoneIcon
                        sx={{
                          fontSize: 'var(--icon-size-small)'
                        }}
                      />
                    ) : (
                      <MoreHorizIcon
                        sx={{
                          fontSize: 'var(--icon-size-small)'
                        }}
                      />
                    )}
                  </IconButton>
                }
              >
                <ListItemButton
                  onClick={() => handleTopicClick(item.id, item.models)}
                  selected={activeTopicId === item.id}
                  sx={{
                    pl: 'var(--spacing-sm)',
                    '&.Mui-selected': {
                      bgcolor: 'var(--grey-200)'
                    }
                  }}
                >
                  <ListItemText
                    primary={topicCaption(item.id, item.name)}
                    slotProps={{
                      primary: {
                        component: 'div',
                        variant: 'body1',
                        color: 'var(--text-secondary)'
                      }
                    }}
                    sx={{
                      mr: '.5rem'
                    }}
                  />
                </ListItemButton>
              </ListItem>

              <Collapse in={item.id === activeTopicId} timeout="auto" unmountOnExit>
                <List component="div" sx={{ background: 'var(--grey-50)' }}>
                  <DragList<IConversation>
                    items={conversations}
                    itemId={(value) => value.modelId}
                    onItemsReordered={(data, info) => handleConvSort(data, info, item.models)}
                  >
                    {(conv) => (
                      <ListItem disablePadding>
                        <ListItemButton
                          dense
                          onClick={() => handleModelSelect(item.id, conv.modelId)}
                          sx={{ pl: 'var(--spacing-sm)' }}
                        >
                          <ListItemIcon sx={{ minWidth: '32px' }}>
                            <Checkbox
                              size="small"
                              edge="start"
                              checked={item.models.includes(conv.modelId)}
                              tabIndex={-1}
                              disableRipple
                              slotProps={{
                                input: {
                                  'aria-labelledby': conv.modelId
                                }
                              }}
                              sx={{
                                transform: isMobile ? 'scale(1)' : 'scale(0.8)',
                                '&.Mui-checked': {
                                  color: '#000'
                                }
                              }}
                            />
                          </ListItemIcon>
                          <ListItemText
                            id={conv.modelId}
                            primary={conv.modelInfo.alias || conv.modelInfo.modelName}
                            slotProps={{
                              primary: {
                                variant: 'body1'
                              }
                            }}
                          ></ListItemText>
                        </ListItemButton>
                      </ListItem>
                    )}
                  </DragList>

                  <ListItem disablePadding>
                    <ListItemButton sx={{ px: 'var(--spacing-sm)' }}>
                      <MenuButton
                        options={modelsOptions}
                        itemClick={createConversation}
                        startIcon={<AddIcon sx={{ fontSize: 'var(--icon-size-small)' }} />}
                      />
                    </ListItemButton>
                  </ListItem>
                </List>
              </Collapse>
            </React.Fragment>
          )}
        </DragList>
      )}
    </List>
  )
})

export default React.memo(TopicList)
