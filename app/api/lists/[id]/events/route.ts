import { getList, isValidListId, subscribe } from '@/lib/listStore'
import { ChecklistItem } from '@/lib/listOps'

export const dynamic = 'force-dynamic'

// Server-Sent Events stream: sends the list on connect and after every change.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!isValidListId(params.id)) {
    return new Response('Invalid list id', { status: 400 })
  }

  const encoder = new TextEncoder()
  let cleanup = () => {}

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          cleanup()
        }
      }
      const sendItems = (items: ChecklistItem[]) => send(`data: ${JSON.stringify(items)}\n\n`)

      const unsubscribe = subscribe(params.id, sendItems)
      const heartbeat = setInterval(() => send(': ping\n\n'), 25000)
      cleanup = () => {
        unsubscribe()
        clearInterval(heartbeat)
      }
      request.signal.addEventListener('abort', () => {
        cleanup()
        try {
          controller.close()
        } catch {}
      })

      sendItems(await getList(params.id))
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
