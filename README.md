# Rivora

**The all-in-one fitness and nutrition SaaS platform.**

> Optimize Your Body. Automate Your Fitness.

---

## Features

- 🏋️ **Workout System** — PPL, Upper/Lower, Full Body splits with exercise guides and video embeds
- 🥗 **Meal Planning** — Weekly meal plans, 6 detailed recipes, grocery list generator
- 📊 **Progress Tracking** — Weight trends, body composition, calorie history charts
- 📅 **Unified Calendar** — Workouts, meals, and check-ins in one view
- 📓 **Interactive Journal** — Mood/energy tracking, daily prompts, tagging
- 🔢 **Personalization Engine** — BMR/TDEE calculator, macro targets based on your goals
- 🤖 **AI Insights** — Logic-based recommendations for nutrition and training
- 🔥 **Streak Tracking** — Consistency streaks and goal progress

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui pattern |
| Animations | Framer Motion |
| Charts | Recharts |
| State | Zustand (with persistence) |
| Auth + DB | Supabase |
| Deployment | Vercel |

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

Add your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Set up the database (optional for demo)

In your Supabase dashboard, run `supabase/schema.sql` in the SQL editor.

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Demo Mode

Click **"View Live Demo"** on the landing page or **"Launch Demo →"** on the login page to explore all features with pre-loaded data — no Supabase setup required.

---

## Project Structure

```
/
├── app/
│   ├── (auth)/          # Login, signup, onboarding
│   ├── (dashboard)/     # All protected dashboard pages
│   │   ├── dashboard/   # Overview with charts
│   │   ├── meals/       # Meal planning + recipes + grocery
│   │   ├── workouts/    # Workout system + active tracker
│   │   ├── tracking/    # Weight, nutrition, workout charts
│   │   ├── calendar/    # Unified calendar view
│   │   ├── journal/     # Daily journaling
│   │   └── settings/    # Profile, goals, data export
│   ├── layout.tsx
│   ├── page.tsx         # Landing page (redirects if authed)
│   └── globals.css
├── components/
│   ├── ui/              # Shared UI primitives
│   ├── landing/         # Landing page sections
│   └── dashboard/       # Sidebar, TopBar
├── lib/
│   ├── utils.ts         # Calculations, helpers
│   ├── mock-data.ts     # Demo data
│   └── supabase.ts      # Supabase client
├── store/
│   └── useAppStore.ts   # Zustand store
├── types/
│   └── index.ts         # TypeScript types
└── supabase/
    └── schema.sql       # Database schema + RLS
```

---

## Personalization Engine

The app uses the **Mifflin-St Jeor** equation for BMR calculation:

- **Males**: `(10 × weight_kg) + (6.25 × height_cm) − (5 × age) + 5`
- **Females**: `(10 × weight_kg) + (6.25 × height_cm) − (5 × age) − 161`

TDEE = BMR × Activity Multiplier

Calorie targets:
- Fat Loss: TDEE − 500 kcal (0.5 kg/week deficit)
- Muscle Gain: TDEE + 250 kcal (lean bulk)
- Maintenance: TDEE
- Athletic Performance: TDEE + 200 kcal

---

## Deployment (Vercel)

```bash
npm install -g vercel
vercel --prod
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel environment variables.

---

## License

MIT
