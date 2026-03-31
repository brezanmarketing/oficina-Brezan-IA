import type { Metadata } from 'next'
import { Space_Grotesk, Inter } from 'next/font/google'
import './globals.css'
import { ProjectProvider } from '@/context/ProjectContext'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-display',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
})

export const metadata: Metadata = {
  title: 'Oficina Brezan IA — Jarvis OS',
  description: 'Sistema de inteligencia artificial central con J.A.R.V.I.S. — Oficina virtual autónoma de Brezan.',
  keywords: 'IA, Jarvis, agentes autónomos, oficina virtual, inteligencia artificial, Brezan',
  openGraph: {
    title: 'Oficina Brezan IA — Jarvis OS',
    description: 'Sistema de inteligencia artificial central con J.A.R.V.I.S.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} antialiased`}
      >
        <ProjectProvider>
          {children}
        </ProjectProvider>
      </body>
    </html>
  )
}
