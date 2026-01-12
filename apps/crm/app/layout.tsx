import type { Metadata } from 'next'
import '@liveblocks/react-tiptap/styles.css'
import './globals.css'
import { Providers } from '@saif/ui'
import NotificationToast from '@/components/NotificationToast'
import TicketModalProvider from '@/components/TicketModalProvider'

export const metadata: Metadata = {
  title: 'SAIF CRM',
  description: 'VC Fund CRM for SAIF',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
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
