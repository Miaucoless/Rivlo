import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ui/theme-provider'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: {
    default: 'Grays Fitness — Optimize Your Body. Automate Your Fitness.',
    template: '%s | Grays Fitness',
  },
  description:
    'The all-in-one fitness and nutrition platform. Track calories, plan meals, log workouts, and hit your goals with personalized automation.',
  keywords: ['fitness', 'nutrition', 'workout tracker', 'meal planner', 'calorie counter'],
  authors: [{ name: 'Grays Fitness' }],
  creator: 'Grays Fitness',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://grays.fit',
    title: 'Grays Fitness — Optimize Your Body. Automate Your Fitness.',
    description: 'The all-in-one fitness and nutrition platform.',
    siteName: 'Grays Fitness',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Grays Fitness',
    description: 'Optimize Your Body. Automate Your Fitness.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange={false}
        >
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
