/**
 * Mock data for demo mode — lets the app run fully without Supabase credentials.
 * All data is realistic and representative of a typical user.
 */

import type {
  UserProfile,
  Recipe,
  Workout,
  WeightEntry,
  WorkoutLog,
  JournalEntry,
  WeeklyMealPlan,
  GroceryList,
} from '@/types'
import { getTodayISO, formatDate } from './utils'
import { format, subDays, subWeeks } from 'date-fns'

export const DEMO_USER: UserProfile = {
  id: 'demo-user-001',
  email: 'alex@grays.fit',
  name: 'Alex Morgan',
  height_cm: 178,
  weight_kg: 82,
  age: 28,
  gender: 'male',
  activity_level: 'moderately_active',
  fitness_goal: 'fat_loss',
  workout_split: 'ppl',
  bmr: 1895,
  tdee: 2937,
  calorie_target: 2437,
  protein_target_g: 180,
  carb_target_g: 218,
  fat_target_g: 81,
  onboarded: true,
  created_at: subDays(new Date(), 45).toISOString(),
  updated_at: new Date().toISOString(),
}

// ─── Recipes ─────────────────────────────────────────────────────────────────────

export const RECIPES: Recipe[] = [
  {
    id: 'r1',
    name: 'High-Protein Greek Yogurt Bowl',
    description: 'Creamy Greek yogurt loaded with berries, granola, and honey for a perfect breakfast.',
    meal_type: 'breakfast',
    prep_time_min: 5,
    cook_time_min: 0,
    servings: 1,
    ingredients: [
      { id: 'i1', name: 'Greek yogurt (0% fat)', amount: 200, unit: 'g', calories_per_unit: 0.57, macros: { protein_g: 0.1, carbs_g: 0.04, fat_g: 0.003 }, estimated_price: 0.8 },
      { id: 'i2', name: 'Mixed berries', amount: 100, unit: 'g', calories_per_unit: 0.57, macros: { protein_g: 0.01, carbs_g: 0.14, fat_g: 0.003 }, estimated_price: 0.6 },
      { id: 'i3', name: 'Granola', amount: 30, unit: 'g', calories_per_unit: 4.5, macros: { protein_g: 0.04, carbs_g: 0.7, fat_g: 0.2 }, estimated_price: 0.3 },
      { id: 'i4', name: 'Honey', amount: 15, unit: 'g', calories_per_unit: 3, macros: { protein_g: 0, carbs_g: 0.8, fat_g: 0 }, estimated_price: 0.1 },
    ],
    instructions: [
      'Scoop Greek yogurt into a bowl.',
      'Top with mixed berries.',
      'Sprinkle granola over the berries.',
      'Drizzle honey to finish.',
    ],
    macros: { calories: 385, protein_g: 32, carbs_g: 45, fat_g: 6, fiber_g: 4 },
    tags: ['high-protein', 'quick', 'no-cook', 'breakfast'],
    image_url: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=400&q=80',
  },
  {
    id: 'r2',
    name: 'Grilled Chicken Rice Bowl',
    description: 'Lean grilled chicken over fluffy rice with roasted veggies and a tahini drizzle.',
    meal_type: 'lunch',
    prep_time_min: 10,
    cook_time_min: 20,
    servings: 1,
    ingredients: [
      { id: 'i5', name: 'Chicken breast', amount: 180, unit: 'g', calories_per_unit: 1.65, macros: { protein_g: 0.31, carbs_g: 0, fat_g: 0.036 }, estimated_price: 1.8 },
      { id: 'i6', name: 'Jasmine rice (cooked)', amount: 150, unit: 'g', calories_per_unit: 1.3, macros: { protein_g: 0.027, carbs_g: 0.28, fat_g: 0.003 }, estimated_price: 0.2 },
      { id: 'i7', name: 'Broccoli', amount: 100, unit: 'g', calories_per_unit: 0.34, macros: { protein_g: 0.028, carbs_g: 0.07, fat_g: 0.004 }, estimated_price: 0.4 },
      { id: 'i8', name: 'Bell pepper', amount: 80, unit: 'g', calories_per_unit: 0.31, macros: { protein_g: 0.01, carbs_g: 0.06, fat_g: 0.003 }, estimated_price: 0.3 },
      { id: 'i9', name: 'Tahini', amount: 15, unit: 'g', calories_per_unit: 5.9, macros: { protein_g: 0.17, carbs_g: 0.24, fat_g: 0.54 }, estimated_price: 0.3 },
    ],
    instructions: [
      'Season chicken breast with salt, pepper, garlic powder, and paprika.',
      'Grill or pan-sear on medium-high heat for 6–7 min per side until internal temp reaches 74°C.',
      'Roast broccoli and bell pepper at 200°C for 15 minutes with olive oil.',
      'Slice chicken and arrange over cooked rice.',
      'Add roasted veggies and drizzle with tahini.',
    ],
    macros: { calories: 548, protein_g: 52, carbs_g: 48, fat_g: 12, fiber_g: 6 },
    tags: ['high-protein', 'meal-prep', 'gluten-free'],
    image_url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&q=80',
  },
  {
    id: 'r3',
    name: 'Salmon & Sweet Potato',
    description: 'Pan-seared salmon with roasted sweet potato and steamed asparagus.',
    meal_type: 'dinner',
    prep_time_min: 10,
    cook_time_min: 25,
    servings: 1,
    ingredients: [
      { id: 'i10', name: 'Salmon fillet', amount: 200, unit: 'g', calories_per_unit: 2.08, macros: { protein_g: 0.2, carbs_g: 0, fat_g: 0.13 }, estimated_price: 3.5 },
      { id: 'i11', name: 'Sweet potato', amount: 200, unit: 'g', calories_per_unit: 0.86, macros: { protein_g: 0.016, carbs_g: 0.2, fat_g: 0.001 }, estimated_price: 0.5 },
      { id: 'i12', name: 'Asparagus', amount: 100, unit: 'g', calories_per_unit: 0.2, macros: { protein_g: 0.022, carbs_g: 0.038, fat_g: 0.001 }, estimated_price: 0.8 },
      { id: 'i13', name: 'Olive oil', amount: 15, unit: 'ml', calories_per_unit: 8.84, macros: { protein_g: 0, carbs_g: 0, fat_g: 1 }, estimated_price: 0.2 },
    ],
    instructions: [
      'Preheat oven to 200°C. Cube sweet potato, toss with olive oil and salt, roast 20 min.',
      'Pat salmon dry, season with salt, pepper, lemon zest.',
      'Heat pan over high heat, add oil. Sear salmon skin-side up for 4 min, flip and cook 3 more.',
      'Steam asparagus for 4 minutes until tender-crisp.',
      'Plate together and squeeze fresh lemon over salmon.',
    ],
    macros: { calories: 612, protein_g: 48, carbs_g: 42, fat_g: 24, fiber_g: 8 },
    tags: ['omega-3', 'high-protein', 'gluten-free', 'dinner'],
    image_url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&q=80',
  },
  {
    id: 'r4',
    name: 'Overnight Oats with Protein',
    description: 'Prep the night before for an effortless, macro-balanced breakfast.',
    meal_type: 'breakfast',
    prep_time_min: 5,
    cook_time_min: 0,
    servings: 1,
    ingredients: [
      { id: 'i14', name: 'Rolled oats', amount: 80, unit: 'g', calories_per_unit: 3.89, macros: { protein_g: 0.17, carbs_g: 0.66, fat_g: 0.07 }, estimated_price: 0.2 },
      { id: 'i15', name: 'Protein powder (vanilla)', amount: 30, unit: 'g', calories_per_unit: 4, macros: { protein_g: 0.8, carbs_g: 0.1, fat_g: 0.03 }, estimated_price: 0.5 },
      { id: 'i16', name: 'Almond milk', amount: 200, unit: 'ml', calories_per_unit: 0.15, macros: { protein_g: 0.005, carbs_g: 0.01, fat_g: 0.01 }, estimated_price: 0.3 },
      { id: 'i17', name: 'Banana', amount: 100, unit: 'g', calories_per_unit: 0.89, macros: { protein_g: 0.011, carbs_g: 0.23, fat_g: 0.003 }, estimated_price: 0.2 },
      { id: 'i18', name: 'Chia seeds', amount: 10, unit: 'g', calories_per_unit: 4.86, macros: { protein_g: 0.17, carbs_g: 0.42, fat_g: 0.31 }, estimated_price: 0.2 },
    ],
    instructions: [
      'Combine oats, protein powder, and chia seeds in a jar.',
      'Pour almond milk over and stir well.',
      'Seal and refrigerate overnight (or at least 4 hours).',
      'In the morning, top with sliced banana.',
    ],
    macros: { calories: 490, protein_g: 38, carbs_g: 58, fat_g: 9, fiber_g: 10 },
    tags: ['meal-prep', 'high-protein', 'breakfast', 'no-cook'],
    image_url: 'https://images.unsplash.com/photo-1606914501449-5a96b6ce24ca?w=400&q=80',
  },
  {
    id: 'r5',
    name: 'Turkey & Veggie Stir Fry',
    description: 'Quick and macro-friendly lean turkey stir fry with colorful vegetables.',
    meal_type: 'dinner',
    prep_time_min: 10,
    cook_time_min: 15,
    servings: 1,
    ingredients: [
      { id: 'i19', name: 'Ground turkey (lean)', amount: 200, unit: 'g', calories_per_unit: 1.49, macros: { protein_g: 0.29, carbs_g: 0, fat_g: 0.08 }, estimated_price: 2.0 },
      { id: 'i20', name: 'Mixed vegetables (frozen)', amount: 150, unit: 'g', calories_per_unit: 0.7, macros: { protein_g: 0.03, carbs_g: 0.13, fat_g: 0.005 }, estimated_price: 0.5 },
      { id: 'i21', name: 'Soy sauce (low sodium)', amount: 30, unit: 'ml', calories_per_unit: 0.6, macros: { protein_g: 0.06, carbs_g: 0.05, fat_g: 0 }, estimated_price: 0.1 },
      { id: 'i22', name: 'Brown rice (cooked)', amount: 130, unit: 'g', calories_per_unit: 1.1, macros: { protein_g: 0.025, carbs_g: 0.23, fat_g: 0.009 }, estimated_price: 0.2 },
    ],
    instructions: [
      'Heat wok or large pan over high heat.',
      'Cook ground turkey, breaking apart, until browned (8 min).',
      'Add frozen vegetables and stir-fry 5 more minutes.',
      'Add soy sauce, garlic, and ginger. Toss to combine.',
      'Serve over brown rice.',
    ],
    macros: { calories: 520, protein_g: 55, carbs_g: 42, fat_g: 10, fiber_g: 5 },
    tags: ['high-protein', 'quick', 'gluten-free-option'],
    image_url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=80',
  },
  {
    id: 'r6',
    name: 'Tuna Salad Wrap',
    description: 'High-protein tuna salad in a whole wheat wrap with crunchy veggies.',
    meal_type: 'lunch',
    prep_time_min: 8,
    cook_time_min: 0,
    servings: 1,
    ingredients: [
      { id: 'i23', name: 'Canned tuna (in water)', amount: 150, unit: 'g', calories_per_unit: 1.16, macros: { protein_g: 0.26, carbs_g: 0, fat_g: 0.013 }, estimated_price: 0.8 },
      { id: 'i24', name: 'Whole wheat tortilla', amount: 60, unit: 'g', calories_per_unit: 3, macros: { protein_g: 0.09, carbs_g: 0.47, fat_g: 0.06 }, estimated_price: 0.3 },
      { id: 'i25', name: 'Greek yogurt (plain)', amount: 40, unit: 'g', calories_per_unit: 0.57, macros: { protein_g: 0.1, carbs_g: 0.04, fat_g: 0.003 }, estimated_price: 0.2 },
      { id: 'i26', name: 'Celery', amount: 50, unit: 'g', calories_per_unit: 0.16, macros: { protein_g: 0.007, carbs_g: 0.03, fat_g: 0.002 }, estimated_price: 0.1 },
      { id: 'i27', name: 'Red onion', amount: 20, unit: 'g', calories_per_unit: 0.4, macros: { protein_g: 0.01, carbs_g: 0.09, fat_g: 0.001 }, estimated_price: 0.05 },
    ],
    instructions: [
      'Drain canned tuna thoroughly.',
      'Mix tuna with Greek yogurt, diced celery, and red onion.',
      'Season with salt, pepper, and lemon juice.',
      'Spread onto whole wheat tortilla and roll tightly.',
    ],
    macros: { calories: 420, protein_g: 48, carbs_g: 32, fat_g: 8, fiber_g: 4 },
    tags: ['high-protein', 'quick', 'no-cook', 'lunch'],
    image_url: 'https://images.unsplash.com/photo-1580013759032-c96505e24c1f?w=400&q=80',
  },
]

// ─── Workouts ─────────────────────────────────────────────────────────────────────

export const WORKOUTS: Workout[] = [
  {
    id: 'w1',
    name: 'Push Day A — Chest & Shoulders',
    description: 'Heavy compound movements followed by isolation work for chest, shoulders, and triceps.',
    day_label: 'Push A',
    muscle_groups: ['chest', 'shoulders', 'triceps'],
    estimated_duration_min: 65,
    difficulty: 'intermediate',
    split_type: 'ppl',
    exercises: [
      {
        exercise: {
          id: 'e1',
          name: 'Barbell Bench Press',
          muscle_groups: ['chest', 'shoulders', 'triceps'],
          equipment: 'Barbell + Bench',
          difficulty: 'intermediate',
          description: 'The king of upper body pressing movements.',
          video_url: 'https://www.youtube.com/embed/vcBig73ojpE',
          instructions: ['Grip bar slightly wider than shoulder width', 'Lower bar to chest with control', 'Press explosively upward', 'Keep feet flat on floor'],
        },
        sets: [
          { set_number: 1, reps: 5, weight_kg: 100, rest_seconds: 180 },
          { set_number: 2, reps: 5, weight_kg: 100, rest_seconds: 180 },
          { set_number: 3, reps: 5, weight_kg: 100, rest_seconds: 180 },
          { set_number: 4, reps: 5, weight_kg: 95, rest_seconds: 180 },
          { set_number: 5, reps: 5, weight_kg: 95, rest_seconds: 180 },
        ],
      },
      {
        exercise: {
          id: 'e2',
          name: 'Incline Dumbbell Press',
          muscle_groups: ['chest', 'shoulders'],
          equipment: 'Dumbbells + Incline Bench',
          difficulty: 'intermediate',
          description: 'Hits the upper chest fibers for complete development.',
          video_url: 'https://www.youtube.com/embed/8iPEnn-ltC8',
          instructions: ['Set bench to 30–45° incline', 'Press dumbbells up and slightly together', 'Lower with 2-second eccentric'],
        },
        sets: [
          { set_number: 1, reps: 10, weight_kg: 30, rest_seconds: 120 },
          { set_number: 2, reps: 10, weight_kg: 30, rest_seconds: 120 },
          { set_number: 3, reps: 10, weight_kg: 28, rest_seconds: 120 },
          { set_number: 4, reps: 12, weight_kg: 26, rest_seconds: 120 },
        ],
      },
      {
        exercise: {
          id: 'e3',
          name: 'Overhead Press (Military)',
          muscle_groups: ['shoulders', 'triceps'],
          equipment: 'Barbell',
          difficulty: 'intermediate',
          description: 'Builds overall shoulder mass and strength.',
          video_url: 'https://www.youtube.com/embed/2yjwXTZQDDI',
          instructions: ['Stand with bar at shoulder height', 'Press straight up, lock out elbows', 'Avoid excessive lumbar extension'],
        },
        sets: [
          { set_number: 1, reps: 8, weight_kg: 60, rest_seconds: 120 },
          { set_number: 2, reps: 8, weight_kg: 60, rest_seconds: 120 },
          { set_number: 3, reps: 8, weight_kg: 57.5, rest_seconds: 120 },
          { set_number: 4, reps: 10, weight_kg: 55, rest_seconds: 120 },
        ],
      },
      {
        exercise: {
          id: 'e4',
          name: 'Cable Lateral Raises',
          muscle_groups: ['shoulders'],
          equipment: 'Cable Machine',
          difficulty: 'beginner',
          description: 'Isolates the lateral deltoid for wider shoulders.',
          video_url: 'https://www.youtube.com/embed/PPsOaMbpWNg',
          instructions: ['Stand side-on to cable', 'Raise arm to shoulder height', 'Control the descent'],
        },
        sets: [
          { set_number: 1, reps: 15, weight_kg: 10, rest_seconds: 60 },
          { set_number: 2, reps: 15, weight_kg: 10, rest_seconds: 60 },
          { set_number: 3, reps: 15, weight_kg: 10, rest_seconds: 60 },
          { set_number: 4, reps: 15, weight_kg: 10, rest_seconds: 60 },
        ],
      },
      {
        exercise: {
          id: 'e5',
          name: 'Tricep Pushdowns (Rope)',
          muscle_groups: ['triceps'],
          equipment: 'Cable Machine + Rope Attachment',
          difficulty: 'beginner',
          description: 'Excellent tricep isolation with constant tension.',
          video_url: 'https://www.youtube.com/embed/2-LAMcpzODU',
          instructions: ['Grip rope with palms facing each other', 'Keep elbows pinned to sides', 'Fully extend and squeeze at bottom'],
        },
        sets: [
          { set_number: 1, reps: 15, weight_kg: 20, rest_seconds: 60 },
          { set_number: 2, reps: 15, weight_kg: 20, rest_seconds: 60 },
          { set_number: 3, reps: 15, weight_kg: 20, rest_seconds: 60 },
        ],
      },
    ],
  },
  {
    id: 'w2',
    name: 'Pull Day A — Back & Biceps',
    description: 'Compound pulling movements and bicep isolation for a thick, wide back.',
    day_label: 'Pull A',
    muscle_groups: ['back', 'biceps', 'forearms'],
    estimated_duration_min: 70,
    difficulty: 'intermediate',
    split_type: 'ppl',
    exercises: [
      {
        exercise: {
          id: 'e6',
          name: 'Barbell Deadlift',
          muscle_groups: ['back', 'hamstrings', 'glutes'],
          equipment: 'Barbell',
          difficulty: 'advanced',
          description: 'The ultimate full-body compound movement.',
          video_url: 'https://www.youtube.com/embed/op9kVnSso6Q',
          instructions: ['Bar over mid-foot', 'Grip just outside legs', 'Chest up, brace core', 'Drive feet into floor'],
        },
        sets: [
          { set_number: 1, reps: 5, weight_kg: 140, rest_seconds: 240 },
          { set_number: 2, reps: 5, weight_kg: 140, rest_seconds: 240 },
          { set_number: 3, reps: 5, weight_kg: 130, rest_seconds: 240 },
        ],
      },
      {
        exercise: {
          id: 'e7',
          name: 'Pull-Ups (Weighted)',
          muscle_groups: ['back', 'biceps'],
          equipment: 'Pull-Up Bar + Belt',
          difficulty: 'intermediate',
          description: 'Best back width builder.',
          video_url: 'https://www.youtube.com/embed/eGo4IYlbE5g',
          instructions: ['Grip slightly wider than shoulders', 'Initiate with lats, pull elbows down', 'Full range of motion'],
        },
        sets: [
          { set_number: 1, reps: 8, weight_kg: 10, rest_seconds: 180 },
          { set_number: 2, reps: 8, weight_kg: 10, rest_seconds: 180 },
          { set_number: 3, reps: 8, weight_kg: 7.5, rest_seconds: 180 },
          { set_number: 4, reps: 10, weight_kg: 0, rest_seconds: 180 },
        ],
      },
      {
        exercise: {
          id: 'e8',
          name: 'Barbell Bent-Over Row',
          muscle_groups: ['back', 'biceps'],
          equipment: 'Barbell',
          difficulty: 'intermediate',
          description: 'Builds back thickness through compound rowing.',
          video_url: 'https://www.youtube.com/embed/FWJR5Ve8bnQ',
          instructions: ['Hinge at hips to ~45°', 'Pull bar to lower chest', 'Squeeze lats at top'],
        },
        sets: [
          { set_number: 1, reps: 8, weight_kg: 80, rest_seconds: 120 },
          { set_number: 2, reps: 8, weight_kg: 80, rest_seconds: 120 },
          { set_number: 3, reps: 10, weight_kg: 75, rest_seconds: 120 },
          { set_number: 4, reps: 10, weight_kg: 70, rest_seconds: 120 },
        ],
      },
      {
        exercise: {
          id: 'e9',
          name: 'Barbell Curl',
          muscle_groups: ['biceps'],
          equipment: 'Barbell',
          difficulty: 'beginner',
          description: 'Classic bicep mass builder.',
          video_url: 'https://www.youtube.com/embed/kwG2ipFRgfo',
          instructions: ['Grip shoulder-width', 'Keep elbows pinned at sides', 'Full range of motion'],
        },
        sets: [
          { set_number: 1, reps: 10, weight_kg: 40, rest_seconds: 90 },
          { set_number: 2, reps: 10, weight_kg: 40, rest_seconds: 90 },
          { set_number: 3, reps: 12, weight_kg: 35, rest_seconds: 90 },
        ],
      },
    ],
  },
  {
    id: 'w3',
    name: 'Leg Day A — Quads & Glutes',
    description: 'Squat-focused leg session targeting quads, glutes, and hamstrings.',
    day_label: 'Leg A',
    muscle_groups: ['quads', 'glutes', 'hamstrings', 'calves'],
    estimated_duration_min: 75,
    difficulty: 'intermediate',
    split_type: 'ppl',
    exercises: [
      {
        exercise: {
          id: 'e10',
          name: 'Barbell Back Squat',
          muscle_groups: ['quads', 'glutes'],
          equipment: 'Barbell + Squat Rack',
          difficulty: 'intermediate',
          description: 'The king of leg movements.',
          video_url: 'https://www.youtube.com/embed/ultWZbUMPL8',
          instructions: ['Bar on traps, not neck', 'Break at hips and knees together', 'Hit parallel or below', 'Drive through heels'],
        },
        sets: [
          { set_number: 1, reps: 5, weight_kg: 120, rest_seconds: 240 },
          { set_number: 2, reps: 5, weight_kg: 120, rest_seconds: 240 },
          { set_number: 3, reps: 5, weight_kg: 120, rest_seconds: 240 },
          { set_number: 4, reps: 8, weight_kg: 100, rest_seconds: 240 },
          { set_number: 5, reps: 8, weight_kg: 100, rest_seconds: 240 },
        ],
      },
      {
        exercise: {
          id: 'e11',
          name: 'Romanian Deadlift',
          muscle_groups: ['hamstrings', 'glutes'],
          equipment: 'Barbell',
          difficulty: 'intermediate',
          description: 'Hip hinge for hamstring and glute development.',
          video_url: 'https://www.youtube.com/embed/JCXUYuzwNrM',
          instructions: ['Keep back straight', 'Push hips back, not knees forward', 'Feel hamstring stretch at bottom'],
        },
        sets: [
          { set_number: 1, reps: 10, weight_kg: 90, rest_seconds: 120 },
          { set_number: 2, reps: 10, weight_kg: 90, rest_seconds: 120 },
          { set_number: 3, reps: 10, weight_kg: 85, rest_seconds: 120 },
          { set_number: 4, reps: 12, weight_kg: 80, rest_seconds: 120 },
        ],
      },
      {
        exercise: {
          id: 'e12',
          name: 'Leg Press',
          muscle_groups: ['quads', 'glutes'],
          equipment: 'Leg Press Machine',
          difficulty: 'beginner',
          description: 'High-volume quad work without axial load.',
          video_url: 'https://www.youtube.com/embed/IZxyjW7MPJQ',
          instructions: ['Feet shoulder-width, slightly turned out', 'Lower until 90° knee angle', 'Do not lock out fully'],
        },
        sets: [
          { set_number: 1, reps: 12, weight_kg: 180, rest_seconds: 90 },
          { set_number: 2, reps: 12, weight_kg: 180, rest_seconds: 90 },
          { set_number: 3, reps: 15, weight_kg: 160, rest_seconds: 90 },
          { set_number: 4, reps: 15, weight_kg: 160, rest_seconds: 90 },
        ],
      },
      {
        exercise: {
          id: 'e13',
          name: 'Standing Calf Raises',
          muscle_groups: ['calves'],
          equipment: 'Smith Machine or Calf Raise Machine',
          difficulty: 'beginner',
          description: 'Calf isolation for lower leg development.',
          video_url: 'https://www.youtube.com/embed/-M4-G8p1fCI',
          instructions: ['Full range of motion', 'Pause and squeeze at top', 'Slow eccentric (3 sec)'],
        },
        sets: [
          { set_number: 1, reps: 20, weight_kg: 80, rest_seconds: 60 },
          { set_number: 2, reps: 20, weight_kg: 80, rest_seconds: 60 },
          { set_number: 3, reps: 20, weight_kg: 80, rest_seconds: 60 },
          { set_number: 4, reps: 20, weight_kg: 80, rest_seconds: 60 },
        ],
      },
    ],
  },
]

// ─── Weekly Meal Plan ─────────────────────────────────────────────────────────────

export const WEEKLY_MEAL_PLAN: WeeklyMealPlan = {
  id: 'wmp1',
  user_id: DEMO_USER.id,
  week_start: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  days: {
    monday: { breakfast: RECIPES[0], lunch: RECIPES[1], dinner: RECIPES[2] },
    tuesday: { breakfast: RECIPES[3], lunch: RECIPES[5], dinner: RECIPES[4] },
    wednesday: { breakfast: RECIPES[0], lunch: RECIPES[1], dinner: RECIPES[2] },
    thursday: { breakfast: RECIPES[3], lunch: RECIPES[5], dinner: RECIPES[4] },
    friday: { breakfast: RECIPES[0], lunch: RECIPES[1], dinner: RECIPES[2] },
    saturday: { breakfast: RECIPES[3], lunch: RECIPES[5], dinner: RECIPES[4] },
    sunday: { breakfast: RECIPES[0], lunch: RECIPES[1], dinner: RECIPES[2] },
  },
}

function startOfWeek(date: Date, opts: { weekStartsOn: number }): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day - opts.weekStartsOn + 7) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// ─── Weight History ───────────────────────────────────────────────────────────────

export const WEIGHT_HISTORY: WeightEntry[] = Array.from({ length: 45 }, (_, i) => ({
  id: `we${i}`,
  user_id: DEMO_USER.id,
  date: format(subDays(new Date(), 44 - i), 'yyyy-MM-dd'),
  weight_kg: 87 - (i * 0.11) + (Math.random() - 0.5) * 0.4,
  body_fat_pct: 23 - (i * 0.07) + (Math.random() - 0.5) * 0.2,
}))

// ─── Journal Entries ──────────────────────────────────────────────────────────────

export const JOURNAL_ENTRIES: JournalEntry[] = [
  {
    id: 'j1',
    user_id: DEMO_USER.id,
    date: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
    title: 'Crushed Push Day',
    content: 'Felt really strong today. Hit a new PR on bench press — 105kg for 3 reps! Energy was great throughout. Nutrition was on point yesterday so I think that helped. Kept rest times strict at 3 minutes for compounds.',
    mood: 5,
    energy: 4,
    tags: ['workout', 'motivation'],
    prompts_answered: {
      workout_feel: 'Excellent. PR day!',
      energy_description: 'High energy from the start',
    },
    created_at: subDays(new Date(), 1).toISOString(),
    updated_at: subDays(new Date(), 1).toISOString(),
  },
  {
    id: 'j2',
    user_id: DEMO_USER.id,
    date: format(subDays(new Date(), 3), 'yyyy-MM-dd'),
    title: 'Struggled with diet',
    content: 'Work was crazy today and I ended up skipping lunch. By the time I got home I was ravenous and probably overate dinner. Need to meal prep better this week. At least I got the workout in even if it was at 9pm.',
    mood: 3,
    energy: 2,
    tags: ['diet', 'stress'],
    prompts_answered: {
      energy_description: 'Low energy, busy day',
      goals_reflection: 'Need to prioritize meal prep',
    },
    created_at: subDays(new Date(), 3).toISOString(),
    updated_at: subDays(new Date(), 3).toISOString(),
  },
  {
    id: 'j3',
    user_id: DEMO_USER.id,
    date: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    title: 'Week 1 Complete',
    content: 'Finished the first full week of the program. Logged all 3 workouts, hit my protein targets 5 out of 7 days, and lost 0.4kg. Small wins adding up. The app is keeping me accountable.',
    mood: 4,
    energy: 4,
    tags: ['motivation', 'mood', 'workout', 'diet'],
    prompts_answered: {
      goals_reflection: 'On track, staying consistent',
    },
    created_at: subDays(new Date(), 7).toISOString(),
    updated_at: subDays(new Date(), 7).toISOString(),
  },
]

// ─── Grocery List ─────────────────────────────────────────────────────────────────

export const GROCERY_LIST: GroceryList = {
  id: 'gl1',
  user_id: DEMO_USER.id,
  week_start: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  total_estimated_cost: 68.50,
  created_at: new Date().toISOString(),
  items: [
    { ingredient: 'Chicken breast', amount: 1260, unit: 'g', estimated_price: 12.60, category: 'Protein', checked: false },
    { ingredient: 'Salmon fillet', amount: 1400, unit: 'g', estimated_price: 24.50, category: 'Protein', checked: false },
    { ingredient: 'Ground turkey (lean)', amount: 1400, unit: 'g', estimated_price: 14.00, category: 'Protein', checked: false },
    { ingredient: 'Canned tuna (in water)', amount: 450, unit: 'g', estimated_price: 2.40, category: 'Protein', checked: true },
    { ingredient: 'Greek yogurt (0% fat)', amount: 2000, unit: 'g', estimated_price: 8.00, category: 'Dairy', checked: false },
    { ingredient: 'Jasmine rice', amount: 1050, unit: 'g', estimated_price: 1.40, category: 'Grains', checked: true },
    { ingredient: 'Brown rice', amount: 910, unit: 'g', estimated_price: 1.40, category: 'Grains', checked: true },
    { ingredient: 'Rolled oats', amount: 560, unit: 'g', estimated_price: 1.10, category: 'Grains', checked: false },
    { ingredient: 'Whole wheat tortilla', amount: 420, unit: 'g', estimated_price: 2.10, category: 'Grains', checked: false },
    { ingredient: 'Broccoli', amount: 700, unit: 'g', estimated_price: 2.80, category: 'Vegetables', checked: false },
    { ingredient: 'Asparagus', amount: 700, unit: 'g', estimated_price: 5.60, category: 'Vegetables', checked: false },
    { ingredient: 'Mixed vegetables (frozen)', amount: 1050, unit: 'g', estimated_price: 3.50, category: 'Vegetables', checked: false },
    { ingredient: 'Bell peppers', amount: 560, unit: 'g', estimated_price: 2.10, category: 'Vegetables', checked: false },
    { ingredient: 'Sweet potato', amount: 1400, unit: 'g', estimated_price: 3.50, category: 'Vegetables', checked: false },
    { ingredient: 'Mixed berries (frozen)', amount: 700, unit: 'g', estimated_price: 4.20, category: 'Fruits', checked: false },
    { ingredient: 'Banana', amount: 700, unit: 'g', estimated_price: 1.40, category: 'Fruits', checked: true },
    { ingredient: 'Almond milk', amount: 1400, unit: 'ml', estimated_price: 2.10, category: 'Dairy Alternatives', checked: false },
    { ingredient: 'Olive oil', amount: 105, unit: 'ml', estimated_price: 1.40, category: 'Pantry', checked: true },
    { ingredient: 'Soy sauce (low sodium)', amount: 210, unit: 'ml', estimated_price: 0.70, category: 'Pantry', checked: true },
    { ingredient: 'Tahini', amount: 105, unit: 'g', estimated_price: 2.10, category: 'Pantry', checked: false },
    { ingredient: 'Granola', amount: 210, unit: 'g', estimated_price: 2.10, category: 'Pantry', checked: false },
    { ingredient: 'Chia seeds', amount: 70, unit: 'g', estimated_price: 1.40, category: 'Pantry', checked: true },
    { ingredient: 'Protein powder (vanilla)', amount: 210, unit: 'g', estimated_price: 3.50, category: 'Supplements', checked: false },
    { ingredient: 'Honey', amount: 105, unit: 'g', estimated_price: 0.70, category: 'Pantry', checked: true },
  ],
}

// ─── Today's Mock Data ────────────────────────────────────────────────────────────

export interface MealLogEntry {
  id: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  name: string
  macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
  time: string
  recipe: Recipe | null
}

export const TODAY_MEALS: MealLogEntry[] = [
  { id: 'm1', meal_type: 'breakfast' as const, name: 'High-Protein Greek Yogurt Bowl', macros: { calories: 385, protein_g: 32, carbs_g: 45, fat_g: 6 }, time: '7:30 AM', recipe: RECIPES[0] },
  { id: 'm2', meal_type: 'lunch' as const, name: 'Grilled Chicken Rice Bowl', macros: { calories: 548, protein_g: 52, carbs_g: 48, fat_g: 12 }, time: '12:30 PM', recipe: RECIPES[1] },
  { id: 'm3', meal_type: 'snack' as const, name: 'Protein Shake', macros: { calories: 180, protein_g: 35, carbs_g: 8, fat_g: 3 }, time: '3:30 PM', recipe: null },
]

export const TODAY_TOTALS = {
  calories: 1113,
  protein_g: 119,
  carbs_g: 101,
  fat_g: 21,
}
