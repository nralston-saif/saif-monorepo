import type { Metadata, Viewport } from 'next'
import '@liveblocks/react-tiptap/styles.css'
import './globals.css'
import { Providers } from '@saif/ui'
import NotificationToast from '@/components/NotificationToast'
import TicketModalProvider from '@/components/TicketModalProvider'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'SAIF Internal',
  description: 'SAIF Ventures internal platform',
  openGraph: {
    title: 'SAIF Internal',
    description: 'SAIF Ventures internal platform',
    siteName: 'SAIF Internal',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Get nonce from middleware for CSP - can be used for inline scripts
  // Access via: const headersList = await headers(); headersList.get('x-nonce')

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>
          <TicketModalProvider>
            {children}
            <NotificationToast />
          </TicketModalProvider>
        </Providers>
      </body>
    </html>
  )
}
