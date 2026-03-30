import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ui/theme-provider'
import { ScrollLockGuard } from '@/components/ScrollLockGuard'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: {
    default: 'Rivora — Optimize Your Body. Automate Your Fitness.',
    template: '%s | Rivora',
  },
  description:
    'The all-in-one fitness and nutrition platform. Track calories, plan meals, log workouts, and hit your goals with personalized automation.',
  keywords: ['fitness', 'nutrition', 'workout tracker', 'meal planner', 'calorie counter'],
  authors: [{ name: 'Rivora' }],
  creator: 'Rivora',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Rivora',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://rivorafit.com',
    title: 'Rivora — Optimize Your Body. Automate Your Fitness.',
    description: 'The all-in-one fitness and nutrition platform.',
    siteName: 'Rivora',
    images: [{ url: 'https://rivorafit.com/og-image.png', width: 1200, height: 630, alt: 'Rivora' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rivora',
    description: 'Optimize Your Body. Automate Your Fitness.',
    images: ['https://rivorafit.com/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#10b981" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange={false}
        >
          <ScrollLockGuard />
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                color: 'hsl(var(--foreground))',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
