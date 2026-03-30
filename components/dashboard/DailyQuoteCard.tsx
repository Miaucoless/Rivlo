'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Quote as QuoteIcon, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getDailyQuote, type Quote } from '@/lib/quotes-api'
import { toast } from 'sonner'

export function DailyQuoteCard() {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [animKey, setAnimKey] = useState(0)

  const fetchQuote = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true)
      else setLoading(true)

      const newQuote = await getDailyQuote({ forceFresh: showRefresh })
      setQuote(newQuote)
      setAnimKey((k) => k + 1)
    } catch {
      toast.error('Failed to load quote')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchQuote()
  }, [])

  return (
    <Card className="col-span-2 lg:col-span-1 relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <QuoteIcon className="w-4 h-4" />
            <span className="text-xs font-medium">Daily Motivation</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchQuote(true)}
            disabled={refreshing}
            className="h-6 w-6 p-0"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        {loading && !quote ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-pulse space-y-2 w-full">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </div>
          </div>
        ) : quote ? (
          <motion.div
            key={animKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-2"
          >
            <p className="text-sm font-medium leading-relaxed">
              {`"${quote.quote}"`}
            </p>
            <p className="text-xs text-muted-foreground">
              — {quote.author}
            </p>
          </motion.div>
        ) : null}
      </CardContent>
    </Card>
  )
}
