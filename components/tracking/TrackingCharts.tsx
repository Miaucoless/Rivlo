'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getWeightUnitLabel } from '@/lib/utils'

function TrackingTooltip({
  active,
  payload,
  label,
  unitSystem,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string
  unitSystem?: 'imperial' | 'metric'
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-xl">
      <p className="mb-1 text-muted-foreground">{label}</p>
      {payload.map((item) => (
        <p key={`${item.name}-${item.color}`} style={{ color: item.color }} className="font-semibold">
          {item.name}: {typeof item.value === 'number' ? item.value.toFixed(1) : item.value}
          {item.name === 'weight' ? ` ${getWeightUnitLabel(unitSystem || 'imperial')}` : item.name === 'calories' ? ' kcal' : item.name === 'protein' ? 'g' : ''}
        </p>
      ))}
    </div>
  )
}

export function WeightTrendCharts({
  weightChartData,
  weightAxisDomain,
  bodyFatAxisDomain,
  unitSystem,
}: {
  weightChartData: Array<{ date: string; weight: number; bodyFat?: number | null }>
  weightAxisDomain: [number, number]
  bodyFatAxisDomain: [number, number]
  unitSystem: 'imperial' | 'metric'
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Weight Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={weightChartData} margin={{ top: 6, right: 18, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="wt-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  interval={Math.floor(weightChartData.length / 6)}
                  padding={{ left: 4, right: 16 }}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  domain={weightAxisDomain}
                  tickFormatter={(value) => `${Number(value).toFixed(0)}`}
                  width={38}
                />
                <Tooltip content={<TrackingTooltip unitSystem={unitSystem} />} cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }} />
                <Area type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={2} fill="url(#wt-grad)" dot={false} name="weight" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Body Fat % Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weightChartData.filter((entry) => entry.bodyFat)} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(weightChartData.length / 6)} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  domain={bodyFatAxisDomain}
                  tickFormatter={(value) => `${Number(value).toFixed(1)}%`}
                  width={42}
                />
                <Tooltip content={<TrackingTooltip unitSystem={unitSystem} />} cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }} />
                <Line type="monotone" dataKey="bodyFat" stroke="#10b981" strokeWidth={2} dot={false} name="bodyFat" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function NutritionTrendChart({
  calorieHistory,
  nutritionMetric,
  calorieTarget,
  proteinTarget,
}: {
  calorieHistory: Array<{ date: string; calories: number; protein: number }>
  nutritionMetric: 'calories' | 'protein'
  calorieTarget: number
  proteinTarget: number
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={calorieHistory} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip content={<TrackingTooltip />} cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }} />
        <ReferenceLine
          y={nutritionMetric === 'calories' ? calorieTarget : proteinTarget}
          stroke="#f59e0b"
          strokeDasharray="4 2"
          label={{ value: 'Target', position: 'right', fontSize: 10 }}
        />
        <Bar
          dataKey={nutritionMetric}
          fill={nutritionMetric === 'calories' ? '#10b981' : '#0ea5e9'}
          opacity={0.85}
          radius={[3, 3, 0, 0]}
          name={nutritionMetric}
          maxBarSize={32}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function PrProgressChart({
  selectedPrProgress,
  unitSystem,
}: {
  selectedPrProgress: Array<{ displayDate: string; weight: number }>
  unitSystem: 'imperial' | 'metric'
}) {
  return (
    <ResponsiveContainer width="100%" height={170}>
      <LineChart data={selectedPrProgress} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} width={42} />
        <Tooltip content={<TrackingTooltip unitSystem={unitSystem} />} cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }} />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="#10b981"
          strokeWidth={2.25}
          dot={{ r: 3, fill: '#10b981' }}
          activeDot={{ r: 5 }}
          name="weight"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
