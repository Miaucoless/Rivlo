import { WORKOUTS } from '@/lib/content-library'
import type { GroceryList, SavedMealTemplate, SocialPost, WeeklyRecapShareData, Workout } from '@/types'

export type DemoSharedItemType = 'workout' | 'saved_meal' | 'recipe' | 'grocery_list' | 'weekly_recap' | 'social_post'

export type DemoSharedItemPayload = Workout | SavedMealTemplate | GroceryList | WeeklyRecapShareData | SocialPost | null

export type DemoFriend = {
  id: string
  name: string
  username?: string
  avatar_url?: string
}

export type DemoSharedInboxItem = {
  friend_share_id: string
  share_id: string
  item_type: DemoSharedItemType
  item_name: string
  token: string
  message?: string
  owner_name: string
  created_at: string
  demo_payload?: DemoSharedItemPayload
}

export type StoredDemoShare = {
  share_id: string
  token: string
  item_type: DemoSharedItemType
  item_name: string
  item_data: Record<string, unknown>
  owner_name: string
  message?: string
  created_at: string
}

const DEMO_LOCAL_SHARE_STORAGE_KEY = 'rivora-demo-shares'

export const DEMO_FRIENDS: DemoFriend[] = [
  { id: 'demo-friend-jordan', name: 'Jordan Lee', username: 'jordanlifts' },
  { id: 'demo-friend-mia', name: 'Mia Brooks', username: 'miameals' },
  { id: 'demo-friend-chris', name: 'Chris Nolan', username: 'chrisbuilds' },
  { id: 'demo-friend-taylor', name: 'Taylor James', username: 'tayfit' },
]

const DEMO_SHARED_WORKOUT: Workout = {
  ...WORKOUTS[0],
  id: 'demo-shared-workout',
  name: 'Shared Push Day From Jordan',
  description: 'A friend-shared push session for demo mode.',
  source: 'custom',
  updated_at: new Date().toISOString(),
}

const DEMO_SHARED_MEAL: SavedMealTemplate = {
  id: 'demo-shared-meal',
  name: 'Shared Chicken Rice Bowl',
  meal_type: 'lunch',
  macros: { calories: 540, protein_g: 48, carbs_g: 46, fat_g: 14 },
  items: [
    { input: 'chicken breast', matched_name: 'Chicken breast', amount: 6, unit: 'oz', macros: { calories: 280, protein_g: 52, carbs_g: 0, fat_g: 6 } },
    { input: 'white rice', matched_name: 'White rice', amount: 1.25, unit: 'cup', macros: { calories: 256, protein_g: 5, carbs_g: 56, fat_g: 1 } },
    { input: 'avocado', matched_name: 'Avocado', amount: 0.25, unit: 'piece', macros: { calories: 64, protein_g: 1, carbs_g: 4, fat_g: 7 } },
  ],
  updated_at: new Date().toISOString(),
}

const DEMO_SHARED_GROCERY: GroceryList = {
  id: 'demo-shared-grocery',
  user_id: 'demo-friend',
  week_start: new Date().toISOString().slice(0, 10),
  items: [
    { ingredient: 'Chicken breast', amount: 3, unit: 'lb', estimated_price: 18, category: 'Protein', checked: false },
    { ingredient: 'Jasmine rice', amount: 1, unit: 'bag', estimated_price: 6, category: 'Pantry', checked: false },
    { ingredient: 'Greek yogurt', amount: 2, unit: 'tub', estimated_price: 12, category: 'Dairy', checked: false },
  ],
  total_estimated_cost: 36,
  created_at: new Date().toISOString(),
}

const DEMO_WEEKLY_RECAP: WeeklyRecapShareData = {
  week_label: 'Mar 25 – Mar 31',
  status: 'winning',
  headline: 'Strong week across training and nutrition',
  workouts_completed: 5,
  target_workout_days: 5,
  protein_hit_days: 6,
  hydration_hit_days: 5,
  consistency_score: 88,
  weight_delta_kg: -0.4,
  highlight: 'You hit your protein target most days and kept workouts steady all week.',
  recommendation: 'Keep the same structure next week and add one more early hydration win each morning.',
}

export const DEMO_INBOX_ITEMS: DemoSharedInboxItem[] = [
  {
    friend_share_id: 'demo-fs-workout',
    share_id: 'demo-share-workout',
    item_type: 'workout',
    item_name: DEMO_SHARED_WORKOUT.name,
    token: 'demo-workout-token',
    message: 'Thought this would fit your split really well.',
    owner_name: 'Jordan Lee',
    created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    demo_payload: DEMO_SHARED_WORKOUT,
  },
  {
    friend_share_id: 'demo-fs-meal',
    share_id: 'demo-share-meal',
    item_type: 'saved_meal',
    item_name: DEMO_SHARED_MEAL.name,
    token: 'demo-meal-token',
    message: 'Easy high-protein lunch prep.',
    owner_name: 'Mia Brooks',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString(),
    demo_payload: DEMO_SHARED_MEAL,
  },
  {
    friend_share_id: 'demo-fs-grocery',
    share_id: 'demo-share-grocery',
    item_type: 'grocery_list',
    item_name: 'Shared Grocery List',
    token: 'demo-grocery-token',
    message: 'This is the list I used for the week.',
    owner_name: 'Chris Nolan',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    demo_payload: DEMO_SHARED_GROCERY,
  },
  {
    friend_share_id: 'demo-fs-weekly',
    share_id: 'demo-share-weekly',
    item_type: 'weekly_recap',
    item_name: 'Weekly recap from Taylor',
    token: 'demo-weekly-token',
    message: 'Solid week. Protein and workouts both up.',
    owner_name: 'Taylor James',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 40).toISOString(),
    demo_payload: DEMO_WEEKLY_RECAP,
  },
]

export function getDemoSharedItemByToken(token: string) {
  const item = DEMO_INBOX_ITEMS.find((entry) => entry.token === token)
  if (!item) return null

  return {
    share_id: item.share_id,
    item_type: item.item_type,
    item_name: item.item_name,
    item_data: (item.demo_payload ?? {}) as Record<string, unknown>,
    owner_name: item.owner_name,
    message: item.message,
    created_at: item.created_at,
  }
}

export function getDemoSharedInboxItemByToken(token: string) {
  return DEMO_INBOX_ITEMS.find((entry) => entry.token === token) ?? null
}

export function isDemoShareToken(token: string) {
  return DEMO_INBOX_ITEMS.some((entry) => entry.token === token)
}

function readStoredDemoShares(): StoredDemoShare[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(DEMO_LOCAL_SHARE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is StoredDemoShare => !!entry && typeof entry === 'object')
      : []
  } catch {
    return []
  }
}

function writeStoredDemoShares(shares: StoredDemoShare[]) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(DEMO_LOCAL_SHARE_STORAGE_KEY, JSON.stringify(shares))
  } catch {
    // Ignore local storage failures in demo mode.
  }
}

export function createStoredDemoShare(input: {
  itemType: DemoSharedItemType
  itemName: string
  itemData: Record<string, unknown>
  ownerName: string
  message?: string
}) {
  const token = `demo-local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const share: StoredDemoShare = {
    share_id: `demo-local-share-${Date.now()}`,
    token,
    item_type: input.itemType,
    item_name: input.itemName,
    item_data: input.itemData,
    owner_name: input.ownerName,
    message: input.message,
    created_at: new Date().toISOString(),
  }

  const existingShares = readStoredDemoShares().filter((entry) => entry.token !== share.token)
  writeStoredDemoShares([share, ...existingShares].slice(0, 20))
  return share
}

export function getStoredDemoShareByToken(token: string) {
  return readStoredDemoShares().find((entry) => entry.token === token) ?? null
}
