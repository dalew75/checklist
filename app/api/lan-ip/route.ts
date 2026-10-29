import { networkInterfaces } from 'os'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const isPrivate = (ip: string) =>
  ip.startsWith('192.168.') || ip.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)

export function GET() {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter(addr => addr && addr.family === 'IPv4' && !addr.internal)
    .map(addr => addr!.address)
    .sort((a, b) => Number(isPrivate(b)) - Number(isPrivate(a)))

  return NextResponse.json({ ips })
}
