import { store, switchToast, userAtom } from '@/store'
import { logger } from '@/utils'
import { Level } from '@constants'
import { useAtomValue, type PrimitiveAtom } from 'jotai'
import { useCallback } from 'react'

/* 乐观更新
 *
 * 项目里的写操作几乎都是同一套流程：先改本地 state 让界面立刻响应（apply），再落库
 * （commit），成功则用服务端权威数据校正（reconcile），失败则回滚 + 提示（rollback）。
 * 过去这套流程在每个调用点各写一遍，代价是各处细节不一致：有的漏了 rollback（改完就
 * 和服务端悄悄分叉）、有的漏了 try/catch（接口抛错就永久停在乐观态）、
 * `if (user?.isLogin)` 到处重复。这里把它收成一个入口。 */

/** 落库结果的成败判定：api 层统一用 false / null / undefined 表示失败 */
const isCommitFailed = (result: unknown): boolean =>
  result === false || result === null || result === undefined

/** 剔掉失败哨兵后的落库结果，reconcile 与 committed 拿到的都是这个已收窄的类型 */
export type Committed<R> = Exclude<R, false | null | undefined>

export type OptimisticOutcome<R> =
  | { status: 'local' } // 未登录：只改本地，不落库
  | { status: 'committed'; data: Committed<R> } // 落库成功
  | { status: 'failed'; error?: unknown } // 落库失败或抛错，已回滚

export interface OptimisticTask<R> {
  /** 立即写入本地 state。必须同步，否则界面不会"立刻"响应 */
  apply: () => unknown
  /** 落库请求 */
  commit: () => Promise<R>
  /** 落库成功后用服务端权威数据校正本地 state（真实 id、order、version 等） */
  reconcile?: (data: Committed<R>) => unknown
  /** 回滚到 apply 之前的状态，配合 snapshotAtom() 使用 */
  rollback?: () => unknown
  /** 失败时的 toast 文案，不传则不弹 */
  failMessage?: string
}

/** 快照 atom 当前值，返回恢复函数。多个 atom 直接组合：() => { restoreA(); restoreB() } */
export const snapshotAtom = <T>(anAtom: PrimitiveAtom<T>): (() => void) => {
  const snapshot = store.get(anAtom)
  return () => store.set(anAtom, snapshot)
}

export const useOptimistic = () => {
  const user = useAtomValue(userAtom)

  const runOptimistic = useCallback(
    async <R>(task: OptimisticTask<R>): Promise<OptimisticOutcome<R>> => {
      const { apply, commit, reconcile, rollback, failMessage } = task

      apply()

      // 未登录不落库，本地状态就是全部真相
      if (!user?.isLogin) return { status: 'local' }

      const fail = async (error?: unknown): Promise<OptimisticOutcome<R>> => {
        try {
          await rollback?.()
        } catch (rollbackError) {
          logger.error('Optimistic rollback failed:', rollbackError)
        }

        if (failMessage) {
          switchToast({ visible: true, message: failMessage, level: Level.error })
        }

        return { status: 'failed', error }
      }

      let data: R
      try {
        data = await commit()
      } catch (error) {
        logger.error('Optimistic commit failed:', error)
        return fail(error)
      }

      if (isCommitFailed(data)) return fail()

      const committed = data as Committed<R>

      // 落库已经成功，校正失败不能回滚——那会把已落库的写操作从界面上抹掉
      try {
        await reconcile?.(committed)
      } catch (error) {
        logger.error('Optimistic reconcile failed:', error)
      }

      return { status: 'committed', data: committed }
    },
    [user?.isLogin]
  )

  return { runOptimistic }
}
