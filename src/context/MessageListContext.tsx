import React, { useMemo, useState } from 'react'

export interface WidthItem {
  id: string
  width: number
  orignalWidth: number
}

export type ViewSwitchLevel = 'third' | 'half' | 'full'

export interface ViewSwitchState {
  ownerId: string
  level: ViewSwitchLevel
}

const MessageListContext = React.createContext<{
  widths: WidthItem[]
  setWidths: React.Dispatch<React.SetStateAction<WidthItem[]>>
  viewSwitch: ViewSwitchState | null
  setViewSwitch: React.Dispatch<React.SetStateAction<ViewSwitchState | null>>
}>({
  widths: [],
  setWidths: () => {},
  viewSwitch: null,
  setViewSwitch: () => {}
})

export const MessageListProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [widths, setWidths] = useState<WidthItem[]>([])
  const [viewSwitch, setViewSwitch] = useState<ViewSwitchState | null>(null)

  const value = useMemo(
    () => ({ widths, setWidths, viewSwitch, setViewSwitch }),
    [widths, viewSwitch]
  )

  return <MessageListContext.Provider value={value}>{children}</MessageListContext.Provider>
}

export const useMessageListContext = () => {
  return React.useContext(MessageListContext)
}
