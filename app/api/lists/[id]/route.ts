import { NextResponse } from 'next/server'
import { isListOp } from '@/lib/listOps'
import { applyToList, getList, isValidListId } from '@/lib/listStore'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

export async function GET(_request: Request, { params }: Params) {
  if (!isValidListId(params.id)) {
    return NextResponse.json({ error: 'Invalid list id' }, { status: 400 })
  }
  return NextResponse.json({ items: await getList(params.id) })
}

export async function POST(request: Request, { params }: Params) {
  if (!isValidListId(params.id)) {
    return NextResponse.json({ error: 'Invalid list id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!isListOp(body?.op)) {
    return NextResponse.json({ error: 'Invalid op' }, { status: 400 })
  }

  return NextResponse.json({ items: await applyToList(params.id, body.op) })
}
