'use client'

import { Apple, Flame } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { percentage } from '@/lib/utils'

function CalorieTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-xl">
      <p className="mb-1 text-muted-foreground">{label}</p>
      {payload.map((item) => (
        <p key={`${item.name}-${item.color}`} style={{ color: item.color }} className="font-semibold">
          {item.name}: {Math.round(item.value ?? 0)} kcal
        </p>
      ))}
    </div>
  )
}

export function CalorieHistoryCard({
  calorieChartData,
}: {
  calorieChartData: Array<{ day: string; calories: number; target: number }>
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Calorie History</CardTitle>
          <Badge variant="outline" className="text-xs">Last 7 days</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {calorieChartData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={208}>
              <AreaChart data={calorieChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cal-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CalorieTooltip />} />
                <Area
                  type="monotone"
                  dataKey="calories"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#cal-area)"
                  dot={{ fill: '#10b981', r: 3 }}
                  name="calories"
                />
                <Area
                  type="monotone"
                  dataKey="target"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  fill="none"
                  dot={false}
                  name="target"
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-3 bg-emerald-500" /> Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-3 border-t border-dashed border-amber-500 bg-transparent" /> Target
              </span>
            </div>
          </>
        ) : (
          <div className="flex h-[208px] flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <Flame className="mb-3 h-10 w-10 opacity-20" />
            <p>No calorie history yet</p>
            <p className="mt-1 text-xs">Your chart will appear once you log meals on at least one day.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function MacroBreakdownCard({
  todayTotals,
  macroPieData,
  user,
}: {
  todayTotals: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
  macroPieData: Array<{ value: number; color: string }>
  user: { protein_target_g: number; carb_target_g: number; fat_target_g: number }
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Today&apos;s Macros</CardTitle>
      </CardHeader>
      <CardContent>
        {todayTotals.calories > 0 ? (
          <>
            <div className="mb-1 flex justify-center">
              <PieChart width={120} height={120}>
                <Pie
                  data={macroPieData}
                  cx={60}
                  cy={60}
                  innerRadius={36}
                  outerRadius={54}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {macroPieData.map((entry, index) => (
                    <Cell key={`macro-cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Protein', value: todayTotals.protein_g, target: user.protein_target_g, color: '#10b981' },
                { label: 'Carbs', value: todayTotals.carbs_g, target: user.carb_target_g, color: '#3b82f6' },
                { label: 'Fat', value: todayTotals.fat_g, target: user.fat_target_g, color: '#f59e0b' },
              ].map((macro) => (
                <div key={macro.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">{macro.label}</span>
                    <span className="font-medium">{macro.value}g / {macro.target}g</span>
                  </div>
                  <div className="progress-track h-1.5">
                    <div
                      className="progress-fill"
                      style={{ width: `${percentage(macro.value, macro.target)}%`, backgroundColor: macro.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <Apple className="mb-3 h-10 w-10 opacity-20" />
            <p>No meals logged today</p>
            <p className="mt-1 text-xs">Add your first meal above</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
