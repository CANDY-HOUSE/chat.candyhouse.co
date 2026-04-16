import { useMediaQueryContext } from '@/context/MediaQueryContext'
import {
  type DragEndEvent,
  type UniqueIdentifier,
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import React, { useId } from 'react'

const SortableItem = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id
  })

  const style = {
    transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
    transition
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  )
}

interface Props<T> {
  items: Array<T>
  children: React.ReactNode | ((item: T, index: number) => React.ReactNode)
  itemId?: (item: T) => UniqueIdentifier
  onItemsReordered?: (newItems: Array<T>, reorderInfo: ReorderInfo<T>) => void
  containerId?: UniqueIdentifier
}

interface DragItemProps<T> {
  item?: T
  index?: number
}

export interface ReorderInfo<T = unknown> {
  oldIndex: number
  newIndex: number
  items: Array<T>
  item: T
  direction: 'up' | 'down'
  distance: number
}

export const DragList = <T = string,>({
  items,
  children,
  itemId = (item) => String(item),
  onItemsReordered,
  containerId
}: Props<T>) => {
  const { isMobile } = useMediaQueryContext()
  const fallbackContainerId = useId()
  const ctxId = containerId ?? `draglist-${fallbackContainerId}`

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8
    }
  })

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,
      tolerance: 5
    }
  })

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates
  })

  const sensors = useSensors(...(isMobile ? [touchSensor] : [pointerSensor]), keyboardSensor)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    // 仅当处于同一个 Sortable 容器时才处理
    const activeContainer = (active.data.current as any)?.sortable?.containerId
    const overContainer = (over.data.current as any)?.sortable?.containerId
    if (!activeContainer || !overContainer || activeContainer !== overContainer) return

    const activeId = active.id
    const overId = over.id

    const oldIndex = items.findIndex((item) => itemId(item) === activeId)
    const newIndex = items.findIndex((item) => itemId(item) === overId)

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    const updatedItems = arrayMove(items, oldIndex, newIndex)

    if (onItemsReordered) {
      const reorderInfo: ReorderInfo<T> = {
        oldIndex,
        newIndex,
        items,
        item: items[oldIndex]!,
        direction: newIndex > oldIndex ? 'down' : 'up',
        distance: Math.abs(newIndex - oldIndex)
      }
      onItemsReordered(updatedItems, reorderInfo)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
    >
      <SortableContext
        id={ctxId as string}
        items={items.map((item) => itemId(item))}
        strategy={verticalListSortingStrategy}
      >
        {typeof children === 'function'
          ? items.map((item, index) => {
              const id = itemId(item)
              return (
                <SortableItem key={String(id)} id={String(id)}>
                  {children(item, index)}
                </SortableItem>
              )
            })
          : React.Children.map(children, (child, index) => {
              const id = itemId(items[index]!)
              const childToRender = React.isValidElement<DragItemProps<T>>(child)
                ? React.cloneElement(child, {
                    item: items[index],
                    index
                  })
                : child

              return (
                <SortableItem key={String(id)} id={String(id)}>
                  {childToRender}
                </SortableItem>
              )
            })}
      </SortableContext>
    </DndContext>
  )
}
