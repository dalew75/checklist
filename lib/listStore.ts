import { EventEmitter } from 'events'
import { promises as fs } from 'fs'
import path from 'path'
import { applyOp, ChecklistItem, ListOp } from './listOps'

// Kept on globalThis so the cache and subscribers survive dev hot reloads.
const store = ((globalThis as any).__checklistStore ??= {
  lists: new Map<string, ChecklistItem[]>(),
  queues: new Map<string, Promise<unknown>>(),
  events: new EventEmitter().setMaxListeners(0),
}) as {
  lists: Map<string, ChecklistItem[]>
  queues: Map<string, Promise<unknown>>
  events: EventEmitter
}

const listsDir = () => path.join(process.env.DATA_DIR ?? 'data', 'lists')
const listFile = (id: string) => path.join(listsDir(), `${id}.json`)

export const isValidListId = (id: string) => /^[a-z0-9]{8,40}$/.test(id)

export async function getList(id: string): Promise<ChecklistItem[]> {
  const cached = store.lists.get(id)
  if (cached) return cached

  let items: ChecklistItem[] = []
  try {
    items = JSON.parse(await fs.readFile(listFile(id), 'utf8'))
  } catch (e: any) {
    if (e.code !== 'ENOENT') throw e
  }
  store.lists.set(id, items)
  return items
}

// Ops on the same list run one at a time, so each sees the previous one's result.
export function applyToList(id: string, op: ListOp): Promise<ChecklistItem[]> {
  const run = (store.queues.get(id) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const items = applyOp(await getList(id), op)
    store.lists.set(id, items)

    await fs.mkdir(listsDir(), { recursive: true })
    const tmp = `${listFile(id)}.tmp`
    await fs.writeFile(tmp, JSON.stringify(items))
    await fs.rename(tmp, listFile(id))

    store.events.emit(`change:${id}`, items)
    return items
  })
  store.queues.set(id, run)
  return run
}

export function subscribe(id: string, callback: (items: ChecklistItem[]) => void) {
  store.events.on(`change:${id}`, callback)
  return () => {
    store.events.off(`change:${id}`, callback)
  }
}
