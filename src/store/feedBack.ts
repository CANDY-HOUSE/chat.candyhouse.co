import type { BeanAnchor } from '@/types/beantypes'
import { atom } from 'jotai'
import React from 'react'
import { store } from './index'

interface IToast {
  visible: boolean
  message?: string
  level?: 'error' | 'warning' | 'info' | 'success'
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

export const toastAtom = atom<IToast>({ visible: false })
export const dialogAtom = atom<IDialog>({ visible: false })
export const anchorAtom = atom<IAnchor>({})

export const switchToast = (data: IToast): void => {
  store.set(toastAtom, data)
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
