'use client'

import { motion } from 'framer-motion'
import { Star } from 'lucide-react'

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Software Engineer',
    avatar: 'SC',
    color: 'bg-rose-400',
    stars: 5,
    text: "I've tried every fitness app out there. Grays is on a different level. The meal planning + grocery list feature alone saves me 2 hours every week. Down 12kg in 4 months.",
    metric: '-12kg in 4 months',
    metricColor: 'text-emerald-400',
  },
  {
    name: 'Marcus Johnson',
    role: 'Personal Trainer',
    avatar: 'MJ',
    color: 'bg-blue-400',
    stars: 5,
    text: "As a PT, I've recommended this to all my clients. The workout generator is incredibly smart and the progressive overload system actually works. The UI is beautiful too.",
    metric: '30+ clients using it',
    metricColor: 'text-blue-400',
  },
  {
    name: 'Elena Rodriguez',
    role: 'Competitive Swimmer',
    avatar: 'ER',
    color: 'bg-amber-400',
    stars: 5,
    text: "The macro calculator is incredibly accurate. My coach was impressed I could show him detailed nutrition data. The journal helps me track how my energy correlates with food.",
    metric: 'PB at nationals',
    metricColor: 'text-amber-400',
  },
  {
    name: 'James Park',
    role: 'Startup Founder',
    avatar: 'JP',
    color: 'bg-purple-400',
    stars: 5,
    text: "With my crazy schedule I never had time to meal prep. The auto-generated grocery lists changed everything. I batch cook on Sunday and hit my macros all week. Game changer.",
    metric: '90-day streak',
    metricColor: 'text-purple-400',
  },
  {
    name: 'Aisha Williams',
    role: 'CrossFit Athlete',
    avatar: 'AW',
    color: 'bg-emerald-400',
    stars: 5,
    text: "The streak tracking and journal kept me going through the tough days. I've built genuine accountability with myself. The AI recommendations actually make sense and are actionable.",
    metric: '+8kg muscle mass',
    metricColor: 'text-emerald-400',
  },
  {
    name: 'Tom Bergmann',
    role: 'Marathon Runner',
    avatar: 'TB',
    color: 'bg-teal-400',
    stars: 5,
    text: "The calorie and macro targets adjusted perfectly for marathon training. The calendar view showing workouts + nutrition side by side is exactly what endurance athletes need.",
    metric: 'Sub-3hr marathon',
    metricColor: 'text-teal-400',
  },
]

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-24 px-6 bg-gradient-to-b from-transparent to-zinc-950/50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16 space-y-4"
        >
          <span className="text-emerald-400 text-sm font-semibold tracking-widest uppercase">
            Loved by athletes
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-white">
            Real results from real people
          </h2>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            Join thousands of athletes who&apos;ve transformed their fitness with Grays.
          </p>
        </motion.div>

        {/* Testimonial grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="bg-zinc-900/60 border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all duration-300 hover:shadow-xl hover:shadow-black/30 flex flex-col gap-4"
            >
              {/* Stars */}
              <div className="flex gap-0.5">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>

              {/* Text */}
              <p className="text-zinc-300 text-sm leading-relaxed flex-1">&quot;{t.text}&quot;</p>

              {/* Metric badge */}
              <div className={`self-start text-xs font-semibold ${t.metricColor} bg-white/5 px-3 py-1 rounded-full`}>
                {t.metric}
              </div>

              {/* Author */}
              <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                <div className={`w-9 h-9 rounded-full ${t.color} flex items-center justify-center text-sm font-bold text-white`}>
                  {t.avatar}
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{t.name}</p>
                  <p className="text-zinc-500 text-xs">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
