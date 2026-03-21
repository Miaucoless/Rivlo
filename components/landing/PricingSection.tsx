'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Check, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

const plans = [
  {
    name: 'Free',
    price: { monthly: 0, annual: 0 },
    description: 'Perfect for getting started with your fitness journey.',
    features: [
      'Basic calorie & macro tracking',
      'Up to 3 workout logs/week',
      'Daily journal entries',
      '7-day meal plan (1 week)',
      'Basic weight tracking',
      'Community access',
    ],
    missing: [
      'AI recommendations',
      'Unlimited workout logging',
      'Grocery list generator',
      'Data export',
      'Priority support',
    ],
    cta: 'Start Free',
    href: '/signup',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: { monthly: 12, annual: 8 },
    description: 'Everything you need to take your fitness to the next level.',
    badge: 'Most Popular',
    features: [
      'Everything in Free',
      'Unlimited workout logging',
      'AI-powered recommendations',
      'Unlimited meal plan weeks',
      'Grocery list generator',
      'Advanced body composition tracking',
      'Data export (CSV & JSON)',
      'Priority support',
      'Early access to new features',
    ],
    missing: [],
    cta: 'Start 14-Day Trial',
    href: '/signup?plan=pro',
    highlighted: true,
  },
]

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true)

  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 space-y-4"
        >
          <span className="text-emerald-400 text-sm font-semibold tracking-widest uppercase">
            Pricing
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-white">
            Simple, transparent pricing
          </h2>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            Start free, upgrade when you're ready. No hidden fees, cancel anytime.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 pt-4">
            <span className={`text-sm ${!isAnnual ? 'text-white' : 'text-zinc-500'}`}>Monthly</span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${isAnnual ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              aria-label="Toggle billing period"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${isAnnual ? 'translate-x-6' : 'translate-x-0'}`}
              />
            </button>
            <span className={`text-sm ${isAnnual ? 'text-white' : 'text-zinc-500'}`}>
              Annual
              <span className="ml-2 text-emerald-400 text-xs font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Save 33%
              </span>
            </span>
          </div>
        </motion.div>

        {/* Plans */}
        <div className="grid sm:grid-cols-2 gap-5">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className={`relative rounded-2xl p-8 border ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-emerald-950/50 to-zinc-900 border-emerald-500/40 shadow-xl shadow-emerald-900/20'
                  : 'bg-zinc-900/60 border-white/10'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                    <Zap className="w-3 h-3" />
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Plan name & price */}
              <div className="mb-6">
                <h3 className="text-white font-semibold text-lg mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">
                    ${isAnnual ? plan.price.annual : plan.price.monthly}
                  </span>
                  {plan.price.monthly > 0 && (
                    <span className="text-zinc-500 text-sm">/month</span>
                  )}
                </div>
                {isAnnual && plan.price.annual > 0 && (
                  <p className="text-xs text-zinc-500 mt-1">Billed annually (${plan.price.annual * 12}/yr)</p>
                )}
                <p className="text-zinc-400 text-sm mt-3">{plan.description}</p>
              </div>

              {/* CTA */}
              <Link href={plan.href}>
                <Button
                  className="w-full mb-6"
                  variant={plan.highlighted ? 'brand' : 'outline'}
                  size="lg"
                >
                  {plan.cta}
                </Button>
              </Link>

              {/* Features */}
              <div className="space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2.5">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0 ${
                      plan.highlighted ? 'bg-emerald-500/20' : 'bg-zinc-700'
                    }`}>
                      <Check className={`w-2.5 h-2.5 ${plan.highlighted ? 'text-emerald-400' : 'text-zinc-400'}`} />
                    </div>
                    <span className="text-sm text-zinc-300">{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-zinc-500 text-sm mt-8"
        >
          No credit card required for free plan. Cancel Pro subscription anytime.
        </motion.p>
      </div>
    </section>
  )
}
