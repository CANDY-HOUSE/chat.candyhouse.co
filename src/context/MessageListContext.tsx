import React, { useMemo, useState } from 'react'

export interface WidthItem {
  id: string
  width: number
  orignalWidth: number
  expanded?: boolean
}

const MessageListContext = React.createContext<{
  widths: WidthItem[]
  setWidths: React.Dispatch<React.SetStateAction<WidthItem[]>>
}>({
  widths: [],
  setWidths: () => {}
})

export const MessageListProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [widths, setWidths] = useState<WidthItem[]>([])

  const value = useMemo(() => ({ widths, setWidths }), [widths])

  return <MessageListContext.Provider value={value}>{children}</MessageListContext.Provider>
}

export const useMessageListContext = () => {
  return React.useContext(MessageListContext)
}
