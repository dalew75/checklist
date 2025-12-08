import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Checklist App',
  description: 'Simple checklist app with drag and drop',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

