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
import { snapshotAtom, useOptimistic } from '@/hooks/useOptimistic'
import { useTopic } from '@/hooks/useTopic'
import {
  activeModelSelectAtom,
  activeTopicIdAtom,
  bootstrappedAtom,
  conversationsAtom,
  focusMessageAtom,
  switchAnchor,
  topicsAtom,
  userAtom
} from '@/store'
import type { IConversation, ITopics } from '@/types/messagetypes'
import { chat, enhanceEventParams, resolveConversationTitle } from '@/utils'
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
  const [bootstrapped, setBootstrapped] = useAtom(bootstrappedAtom)

  const { resetConversations, getConversations, setConversations, updateAttrsValue } =
    useConversation()
  const { updateAttrsValue: updateTopicAttrsValue } = useTopic()
  const { runOptimistic } = useOptimistic()

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
        const index = topics.findIndex((t) => t.id === topicId)
        const list = topics.toSpliced(index, 1)
        const rollback = snapshotAtom(topicsAtom)

        switchAnchor({ children: null })

        const outcome = runOptimistic({
          apply: () => setTopics(list),
          commit: () => apiTopicsDelete(topicId),
          rollback,
          failMessage: t('DelFail')
        })

        // 选中态跟随本地列表立刻切换，不等落库结果
        if (topicId === activeTopicId) {
          if (list.length > 0) {
            handleTopicClick(list[0]!.id, list[0]!.models)
          } else {
            setActiveTopicId('')
          }
        }

        await outcome
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
    const tIndex = topics.findIndex((item) => item.id === id)

    const finalModels = [...topics[tIndex]!.models]
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

    const rollback = snapshotAtom(topicsAtom)
    const outcome = await runOptimistic({
      // 更新 topics
      apply: () => setTopics(topics.with(tIndex, { ...topics[tIndex]!, models: finalModels })),
      // 话题所属模型变更
      commit: () => apiTopicsUpdate({ id, models: finalModels }),
      rollback,
      failMessage: t('SubmissionFail')
    })

    // 未登录时不拉消息列表（本地无远端消息），落库失败已回滚也不必拉
    if (outcome.status !== 'committed' || anchorTimestamp) return

    // 更新消息列表
    if (isCheck) {
      const convs = getConversations(id)
      convs && (await conversationMessagesInit(model, convs))
    }
  }

  // ‘更多’操作按钮点击
  const handleActionClick = async (e: React.MouseEvent<HTMLElement>, topicId: string) => {
    e.stopPropagation()

    if (editId === topicId) {
      // 提交修改
      const index = topics.findIndex((t) => t.id === topicId)
      const originName = topics[index]?.name
      const name = inputRef.current?.value

      setEditId('')

      if (!name || originName === name) {
        return
      }

      const rollback = snapshotAtom(topicsAtom)

      await runOptimistic({
        apply: () => setTopics(topics.with(index, { ...topics[index]!, name })),
        commit: () => apiTopicsUpdate({ id: topicId, name }),
        // 拉回权威列表（改名会带动 updatedAt/version）
        reconcile: () => getTopicList(),
        rollback,
        failMessage: t('SubmissionFail')
      })
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

    await runOptimistic({
      apply: () => setConversations(data),
      commit: () =>
        apiConversationMove(topicId, {
          targetModelId: modelId,
          beforeModelId: before?.modelId,
          afterModelId: after?.modelId,
          expectedVersion: version ?? 0
        }),
      reconcile: (res) =>
        updateAttrsValue(conversationId, { order: res.order, version: res.version }),
      // 排序冲突多半是并发导致的，回滚后再拉一次权威顺序
      rollback: async () => {
        setConversations(items)
        const latest = await apiConversationsGet(topicId)
        setConversations(latest)
        conversationMessagesInit(models, latest)
      }
    })
  }

  // 话题排序
  const handleTopicSort = async (
    data: ITopics[],
    { newIndex, item, items }: ReorderInfo<ITopics>
  ) => {
    const { before, after } = getNeighbors<ITopics>(data, newIndex)

    await runOptimistic({
      apply: () => setTopics(data),
      commit: () =>
        apiTopicMove({
          targetTopicId: item.id,
          beforeTopicId: before?.id,
          afterTopicId: after?.id,
          expectedVersion: item.version ?? 0
        }),
      reconcile: (res) =>
        updateTopicAttrsValue(item.id, { order: res.order, version: res.version }),
      // 排序冲突多半是并发导致的，回滚后再拉一次权威顺序
      rollback: async () => {
        setTopics(items)
        setTopics(await apiTopicsGet())
      }
    })
  }

  // 新增会话
  const createConversation = async (data: OptionType) => {
    const topicId = activeTopicId
    if (!topicId) return
    const convTmpData = chat.createTplConv(topicId, data.value)
    const model = activeModelSelect.find((m) => m.modelName === data.value)!
    convTmpData.modelInfo = model
    const originConvs = [...conversations]
    // 占位会话先上屏，落库成功后换成带真实 conversationId 的那条
    let newModelId = convTmpData.modelId

    const outcome = await runOptimistic({
      apply: () => setConversations([convTmpData, ...originConvs]),
      commit: () => apiConversationsCreate({ topicId, modelName: data.value }),
      reconcile: async () => {
        const convs = await apiConversationsGet(topicId)
        newModelId = convs[0]!.modelId
        setConversations([convs[0]!, ...originConvs])
      },
      rollback: () => setConversations(originConvs),
      failMessage: t('createFail')
    })

    if (outcome.status !== 'failed') {
      handleModelSelect(topicId, newModelId)
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
    if (loading) return

    if (topics.length > 0) {
      await handleTopicClick(topics[0]!.id, topics[0]!.models)
    }

    // 无论有没有话题都要撤骨架屏：登录用户 0 话题时走的是乐观新建分支
    setBootstrapped(true)
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
      {!bootstrapped ? (
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
                      bgcolor: 'var(--surface-selected)'
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
                <List component="div" sx={{ background: 'var(--surface-content)' }}>
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
                                  color: 'var(--text-primary)'
                                }
                              }}
                            />
                          </ListItemIcon>
                          <ListItemText
                            id={conv.modelId}
                            primary={resolveConversationTitle(conv.modelInfo)}
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
