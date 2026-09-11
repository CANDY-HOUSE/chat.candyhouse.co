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
  store,
  switchAnchor,
  switchToast,
  topicsAtom,
  userAtom
} from '@/store'
import type { IConversation, ITopics } from '@/types/messagetypes'
import { chat, enhanceEventParams, resolveConversationTitle } from '@/utils'
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

/* 搜索结果跳转的目标。这里只认 conversationId：
 * modelId 的形态是 `${modelName}#${conversationId}`，modelName 在会话创建时定型且是
 * DynamoDB 的 SK，模型升级（replacedBy）后不会回写；而消息里的 model 记录的是这条消息
 * 实际使用的模型（已升级后的新名）。两者必然分叉，所以调用方不允许自己拼 modelId，
 * 真实值只能由这里从会话列表反查。 */
export interface JumpTarget {
  topicId: string
  conversationId: string
  anchorKey?: string
}

export interface TopicListRef {
  jumpToMessage: (target: JumpTarget) => Promise<boolean>
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

  const {
    resetConversations,
    getConversations,
    setConversations,
    updateAttrsValue,
    deleteConversation
  } = useConversation()
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
            handleTopicClick(list[0]!.id)
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

  // 取话题的会话列表：本地没有再拉远端。fromServer 标记本次是否为权威数据
  const ensureConversations = async (topicId: string) => {
    const cached = getConversations(topicId)
    if (cached && cached.length > 0) return { convs: cached, fromServer: false }

    const convs = (await apiConversationsGet(topicId)) ?? []
    setConversations(convs, topicId)

    return { convs, fromServer: true }
  }

  // 话题当前的勾选项（权威值取自 topicsAtom，避免闭包里的旧快照）
  const topicModels = (topicId: string) =>
    store.get(topicsAtom).find((item) => item.id === topicId)?.models ?? []

  // 收敛话题的勾选项：剔除库里已不存在的 modelId，并按需补勾一个会话（两件事合成一次写库）
  //
  // 脏数据来源：早期搜索跳转会用 message.model 现拼 modelId，模型升级后拼出的 id 在库中
  // 并不存在，却被 apiTopicsUpdate 持久化进了 topics.models。这类 id 永远匹配不到任何会话，
  // 会让 checkedConversationsAtom 把该会话过滤掉——即使消息拉回来了也不渲染。
  const syncTopicModels = async (
    topicId: string,
    convs: IConversation[],
    options: { ensureModelId?: string; prune?: boolean } = {}
  ): Promise<string[]> => {
    const { ensureModelId, prune = false } = options
    const current = topicModels(topicId)
    // 会话列表为空时无从判断真伪，保持原样
    if (convs.length === 0) return current

    const valid = new Set(convs.map((item) => item.modelId))
    // 剔除只在 convs 刚从服务端取回时才可信：本地缓存可能落后于别处（另一端/另一标签页）
    // 新建的会话，拿它去比对会把合法的勾选项误删掉
    const next = prune ? current.filter((id) => valid.has(id)) : [...current]

    if (ensureModelId && valid.has(ensureModelId) && !next.includes(ensureModelId)) {
      next.push(ensureModelId)
    }

    if (next.length === current.length && next.every((id, i) => id === current[i])) return current

    const rollback = snapshotAtom(topicsAtom)
    const outcome = await runOptimistic({
      apply: () =>
        setTopics((prev) =>
          prev.map((item) => (item.id === topicId ? { ...item, models: next } : item))
        ),
      commit: () => apiTopicsUpdate({ id: topicId, models: next }),
      rollback,
      failMessage: t('SubmissionFail')
    })

    return outcome.status === 'failed' ? current : next
  }

  // 初始化会话消息列表
  const conversationMessagesInit = async (
    model: string[] | string,
    convs: IConversation[],
    anchorKey?: string
  ) => {
    const modelIds = Array.isArray(model) ? model : model ? [model] : []
    const targetConvs = convs.filter((item) => modelIds.includes(item.modelId))

    // 并行请求所有会话消息
    const fetchPromises = targetConvs
      .filter((item) => item.messages?.length === 0 || anchorKey)
      .map(async (item) => {
        const param: {
          id: string
          limit?: number
          preAnchorKey?: string
          nextAnchorKey?: string
        } = { id: item.conversationId }

        if (anchorKey) {
          param.limit = 5
          param.preAnchorKey = anchorKey
          param.nextAnchorKey = anchorKey
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
  const handleTopicClick = async (id: string) => {
    if (id === activeTopicId) return
    if (focusMessage) {
      // 上次跳转留下的是 5 条的锚点片段，切走时丢掉，下次进来才会整体重拉
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
      const { convs, fromServer } = await ensureConversations(id)
      // 存量脏数据自愈，并用收敛后的勾选项去拉消息
      const effective = await syncTopicModels(id, convs, { prune: fromServer })

      await conversationMessagesInit(effective, convs)
    } else {
      resetConversations(id)
    }
  }

  // 搜索结果跳转：以 conversationId 为身份定位会话，真实 modelId 由会话列表反查
  const jumpToMessage = async ({
    topicId,
    conversationId,
    anchorKey
  }: JumpTarget): Promise<boolean> => {
    if (!user?.isLogin) return false

    // 上一次跳转的锚点片段属于切换前的话题，换目标前先丢掉，
    // 否则那个会话会一直停在残缺状态（messages 非空 → 不会再整体重拉）
    if (focusMessage) {
      if (focusMessage.conversationId !== conversationId) {
        updateAttrsValue(
          focusMessage.conversationId,
          {
            messages: [],
            nextToken: null
          },
          activeTopicId!
        )
      }
      setFocusMessage(null)
    }

    setActiveTopicId(topicId)
    setEditId('')

    const { convs, fromServer } = await ensureConversations(topicId)
    const conv = convs.find((item) => item.conversationId === conversationId)

    if (!conv) {
      switchToast({ visible: true, message: t('convGone'), level: Level.error })
      return false
    }

    await syncTopicModels(topicId, convs, { ensureModelId: conv.modelId, prune: fromServer })
    await conversationMessagesInit(conv.modelId, convs, anchorKey)

    return true
  }

  // 模型会话勾选
  const handleModelSelect = async (id: string, model: string) => {
    const tIndex = topics.findIndex((item) => item.id === id)
    if (tIndex < 0) return

    // 防脏写：库里不存在的 modelId 一旦落进 topics.models，该会话就永远勾不上、也不会渲染。
    // 会话列表还没加载时无从校验，放行（此时调用方只可能是本组件内已展开的话题）
    const existing = getConversations(id)
    if (existing && existing.length > 0 && !existing.some((item) => item.modelId === model)) return

    const finalModels = [...topics[tIndex]!.models]
    const mIndex = finalModels.indexOf(model)
    const isCheck = mIndex < 0 // 模型是否勾选

    if (isCheck) {
      // 模型勾选
      finalModels.push(model)
    } else {
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
    if (outcome.status !== 'committed') return

    // 更新消息列表
    if (isCheck) {
      const convs = getConversations(id)
      convs && (await conversationMessagesInit(model, convs))
    }
  }

  // 删除会话：入口在侧边栏会话行（PC hover / 移动端常显），埋点沿用原 ⋮ 菜单项
  const handleConvDelete = async (
    e: React.MouseEvent<HTMLElement>,
    topicId: string,
    conv: IConversation
  ) => {
    e.stopPropagation() // 否则会冒泡到 ListItemButton，顺手把这条会话的勾选态也切了

    await deleteConversation(conv.conversationId, topicId)

    gtag(
      'event',
      'model_management',
      enhanceEventParams({
        action_type: 'remove',
        model_name: conv.modelInfo?.modelName ?? ''
      })
    )
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
      await handleTopicClick(topics[0]!.id)
    }

    // 无论有没有话题都要撤骨架屏：登录用户 0 话题时走的是乐观新建分支
    setBootstrapped(true)
  }

  useImperativeHandle(ref, () => ({
    jumpToMessage
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
                  onClick={() => handleTopicClick(item.id)}
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
                      <ListItem
                        disablePadding
                        sx={{
                          // 触屏设备（hover: none）不进这个块，按钮保持默认显示——即常显。
                          // 用 (hover: hover) 而不是 isMobile：isMobile 是视口宽度判断，
                          // 窄窗口的桌面浏览器同样有 hover，按指针能力分支才对
                          '@media (hover: hover)': {
                            '& .conv-delete': { display: 'none' },
                            '&:hover .conv-delete': { display: 'inline-flex' }
                          }
                        }}
                        secondaryAction={
                          <IconButton
                            edge="end"
                            className="conv-delete"
                            aria-label={t('delete')}
                            // dnd 的 listeners 摊在 DragList 包裹整行的那个 div 上，这三个
                            // 必须拦，否则移动端按住删除按钮超过 250ms 会把整行拖起来
                            onPointerDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onClick={(e) => handleConvDelete(e, item.id, conv)}
                          >
                            <DeleteIcon
                              sx={{
                                fontSize: 'var(--icon-size-small)',
                                color: 'var(--text-secondary)',
                                '&:hover': { color: 'error.main' }
                              }}
                            />
                          </IconButton>
                        }
                      >
                        <ListItemButton
                          dense
                          onClick={() => handleModelSelect(item.id, conv.modelId)}
                          sx={{ pl: 'var(--spacing-sm)', pr: '2.5rem' }}
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
