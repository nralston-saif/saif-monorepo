import type { Metadata } from 'next'
import Providers from '@saif/ui/providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'SAIF Community',
  description: 'Connect with founders in the SAIF Ventures portfolio',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // CSP nonce is available via headers() if needed for inline scripts
  // Access via: const headersList = await headers(); headersList.get('x-nonce')

  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
