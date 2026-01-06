import type { Metadata } from 'next'
import Providers from '@saif/ui/providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'SAIFface - SAIF Ventures Community',
  description: 'Connect with founders in the SAIF Ventures portfolio',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
