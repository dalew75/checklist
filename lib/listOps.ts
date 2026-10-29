export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  deleted: boolean
}

// Changes a client can make to a list. The client applies them optimistically
// and the server applies them authoritatively, so applyOp must stay pure.
export type ListOp =
  | { type: 'import'; items: ChecklistItem[] }
  | { type: 'add'; item: ChecklistItem }
  | { type: 'toggle'; id: string }
  | { type: 'delete'; id: string }
  | { type: 'restore'; id: string }
  | { type: 'move'; activeId: string; overId: string }
  | { type: 'clearTrash' }

const update = (items: ChecklistItem[], id: string, change: Partial<ChecklistItem>) =>
  items.map(item => (item.id === id ? { ...item, ...change } : item))

export function applyOp(items: ChecklistItem[], op: ListOp): ChecklistItem[] {
  switch (op.type) {
    case 'import':
      return op.items
    case 'add':
      return [op.item, ...items.filter(item => item.id !== op.item.id)]
    case 'toggle': {
      const item = items.find(i => i.id === op.id)
      return item ? update(items, op.id, { completed: !item.completed }) : items
    }
    case 'delete':
      return update(items, op.id, { deleted: true })
    case 'restore':
      return update(items, op.id, { deleted: false })
    case 'move': {
      const from = items.findIndex(item => item.id === op.activeId)
      const to = items.findIndex(item => item.id === op.overId)
      if (from === -1 || to === -1 || from === to) return items
      const next = [...items]
      next.splice(to, 0, next.splice(from, 1)[0])
      return next
    }
    case 'clearTrash':
      return items.filter(item => !item.deleted)
  }
}

const isItem = (value: any): value is ChecklistItem =>
  value !== null &&
  typeof value === 'object' &&
  typeof value.id === 'string' &&
  typeof value.text === 'string' &&
  typeof value.completed === 'boolean' &&
  typeof value.deleted === 'boolean'

// Validates an op received over the network.
export function isListOp(op: any): op is ListOp {
  if (op === null || typeof op !== 'object') return false
  switch (op.type) {
    case 'import':
      return Array.isArray(op.items) && op.items.every(isItem)
    case 'add':
      return isItem(op.item)
    case 'toggle':
    case 'delete':
    case 'restore':
      return typeof op.id === 'string'
    case 'move':
      return typeof op.activeId === 'string' && typeof op.overId === 'string'
    case 'clearTrash':
      return true
    default:
      return false
  }
}
