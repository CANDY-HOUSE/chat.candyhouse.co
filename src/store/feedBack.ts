import type { BeanAnchor } from '@/types/beantypes'
import { atom } from 'jotai'
import React from 'react'
import { store } from './index'

interface IToast {
  visible: boolean
  duration?: number
  message?: string
  level?: 'error' | 'warning' | 'info' | 'success'
}

export interface ToastItem extends Omit<IToast, 'visible'> {
  id: number
}

interface IDialog {
  visible: boolean
  children?: React.ReactNode
  onClose?: () => void
}

interface IAnchor {
  children?: React.ReactNode
  config?: BeanAnchor
}

export interface BaseDialog {
  open: boolean
}

export const toastsAtom = atom<ToastItem[]>([])
export const dialogAtom = atom<IDialog>({ visible: false })
export const anchorAtom = atom<IAnchor>({})

let toastId = 0

export const switchToast = (data: IToast): void => {
  if (!data.visible) {
    store.set(toastsAtom, [])
    return
  }
  store.set(toastsAtom, (prev) => [
    ...prev,
    { id: ++toastId, message: data.message, level: data.level, duration: data.duration }
  ])
}

export const dismissToast = (id: number): void => {
  store.set(toastsAtom, (prev) => prev.filter((toast) => toast.id !== id))
}

export const switchAnchor = (data: IAnchor): void => {
  store.set(anchorAtom, data)
}

export const switchDialog = (data: IDialog): void => {
  store.set(dialogAtom, data)
}

export const resetFeedback = () => {
  switchToast({ visible: false, message: '' })
  switchAnchor({ children: null })
  switchDialog({ visible: false, children: null })
}
