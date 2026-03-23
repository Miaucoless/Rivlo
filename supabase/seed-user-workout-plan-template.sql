-- Seed a private 10-week ACFT workout plan for a single account.
-- 1. Run `supabase/add-workout-templates.sql` first.
-- 2. Run this file in the Supabase SQL editor.
-- 3. These templates are inserted only for `lspetrera1213@email.campbell.edu`.

WITH target_profile AS (
  SELECT id
  FROM profiles
  WHERE email = 'lspetrera1213@email.campbell.edu'
  LIMIT 1
),
plan_rows AS (
  SELECT
    'gf-acft-w1-2-d1'::text AS id,
    'Weeks 1-2 • Day 1 - Lower Body + Intervals'::text AS name,
    'Learn + Survive phase. Focus on movement quality, leg strength, and introductory run intervals.'::text AS description,
    'Weeks 1-2 • Day 1'::text AS day_label,
    ARRAY['quads', 'glutes', 'hamstrings', 'cardio']::text[] AS muscle_groups,
    '[
      {
        "exercise": {
          "id": "gf-w12-bodyweight-squat",
          "name": "Bodyweight Squat",
          "muscle_groups": ["quads", "glutes"],
          "equipment": "Bodyweight",
          "difficulty": "beginner",
          "description": "Foundational squat pattern to build leg strength and confidence.",
          "instructions": ["Sit hips back first.", "Keep chest up.", "Stand tall at the top."]
        },
        "sets": [
          { "set_number": 1, "reps": 10, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 2, "reps": 10, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 3, "reps": 10, "weight_kg": 0, "rest_seconds": 60 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w12-db-deadlift",
          "name": "Dumbbell Deadlift",
          "muscle_groups": ["hamstrings", "glutes", "back"],
          "equipment": "Dumbbells",
          "difficulty": "beginner",
          "description": "Intro hinge pattern for posterior-chain strength.",
          "instructions": ["Push hips back.", "Keep dumbbells close to legs.", "Stand tall without leaning back."]
        },
        "sets": [
          { "set_number": 1, "reps": 8, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 2, "reps": 8, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 3, "reps": 8, "weight_kg": 0, "rest_seconds": 75 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w12-walking-lunge",
          "name": "Walking Lunge",
          "muscle_groups": ["quads", "glutes", "hamstrings"],
          "equipment": "Bodyweight or Dumbbells",
          "difficulty": "beginner",
          "description": "Single-leg strength and balance work.",
          "instructions": ["Step long enough to keep front heel down.", "Drop straight down.", "Alternate legs each rep."]
        },
        "sets": [
          { "set_number": 1, "reps": 10, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 2, "reps": 10, "weight_kg": 0, "rest_seconds": 60 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w12-run-intervals",
          "name": "Run Intervals",
          "muscle_groups": ["cardio"],
          "equipment": "Track or Treadmill",
          "difficulty": "beginner",
          "description": "6 rounds of 20 seconds fast jog and 1 minute walk.",
          "instructions": ["Jog fast for 20 seconds.", "Walk for 1 minute.", "Repeat for 6 total rounds."]
        },
        "sets": [
          { "set_number": 1, "reps": 6, "weight_kg": 0, "rest_seconds": 60 }
        ]
      }
    ]'::jsonb AS exercises,
    45::integer AS estimated_duration_min,
    'beginner'::text AS difficulty,
    '6day'::text AS split_type,
    'custom'::text AS source

  UNION ALL

  SELECT
    'gf-acft-w1-2-d2',
    'Weeks 1-2 • Day 2 - Upper Body + Core',
    'Learn + Survive phase upper-body and trunk stability session.',
    'Weeks 1-2 • Day 2',
    ARRAY['chest', 'back', 'core']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w12-incline-pushup",
          "name": "Incline Push-Up",
          "muscle_groups": ["chest", "shoulders", "triceps"],
          "equipment": "Bench or Box",
          "difficulty": "beginner",
          "description": "Scaled push-up variation to build pressing strength.",
          "instructions": ["Keep body straight.", "Lower under control.", "Press back without sagging hips."]
        },
        "sets": [
          { "set_number": 1, "reps": 8, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 2, "reps": 10, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 3, "reps": 12, "weight_kg": 0, "rest_seconds": 60 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w12-db-row",
          "name": "Dumbbell Row",
          "muscle_groups": ["back", "biceps"],
          "equipment": "Dumbbell",
          "difficulty": "beginner",
          "description": "Build pulling strength for posture and upper-body balance.",
          "instructions": ["Brace core.", "Pull elbow toward hip.", "Lower with control."]
        },
        "sets": [
          { "set_number": 1, "reps": 10, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 2, "reps": 10, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 3, "reps": 10, "weight_kg": 0, "rest_seconds": 60 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w12-plank",
          "name": "Plank",
          "muscle_groups": ["core"],
          "equipment": "Bodyweight",
          "difficulty": "beginner",
          "description": "Build midline endurance for the ACFT plank.",
          "instructions": ["Keep ribs down.", "Squeeze glutes.", "Hold a straight line."]
        },
        "sets": [
          { "set_number": 1, "reps": 20, "weight_kg": 0, "rest_seconds": 45 },
          { "set_number": 2, "reps": 20, "weight_kg": 0, "rest_seconds": 45 },
          { "set_number": 3, "reps": 20, "weight_kg": 0, "rest_seconds": 45 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w12-bird-dog",
          "name": "Bird Dog",
          "muscle_groups": ["core"],
          "equipment": "Bodyweight",
          "difficulty": "beginner",
          "description": "Stability drill for core control and coordination.",
          "instructions": ["Reach long through opposite arm and leg.", "Move slowly.", "Avoid twisting hips."]
        },
        "sets": [
          { "set_number": 1, "reps": 10, "weight_kg": 0, "rest_seconds": 45 },
          { "set_number": 2, "reps": 10, "weight_kg": 0, "rest_seconds": 45 }
        ]
      }
    ]'::jsonb,
    35,
    'beginner',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w1-2-d3',
    'Weeks 1-2 • Day 3 - Sprint Conditioning',
    'Learn + Survive phase sprint and carry conditioning.',
    'Weeks 1-2 • Day 3',
    ARRAY['cardio', 'full_body']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w12-sprint-conditioning",
          "name": "Sprint Intervals",
          "muscle_groups": ["cardio"],
          "equipment": "Track or Field",
          "difficulty": "beginner",
          "description": "6 rounds of 20-second sprint and 1-minute walk.",
          "instructions": ["Sprint for 20 seconds.", "Walk for 1 minute.", "Repeat for 6 rounds."]
        },
        "sets": [
          { "set_number": 1, "reps": 6, "weight_kg": 0, "rest_seconds": 60 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w12-farmer-carry-light",
          "name": "Farmer Carry",
          "muscle_groups": ["full_body", "core"],
          "equipment": "Dumbbells or Kettlebells",
          "difficulty": "beginner",
          "description": "Light carry work for grip, posture, and ACFT prep.",
          "instructions": ["Stand tall.", "Walk under control.", "Keep shoulders down and tight."]
        },
        "sets": [
          { "set_number": 1, "reps": 30, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 2, "reps": 30, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 3, "reps": 30, "weight_kg": 0, "rest_seconds": 60 }
        ]
      }
    ]'::jsonb,
    30,
    'beginner',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w1-2-d4',
    'Weeks 1-2 • Day 4 - Lower Body + Easy Run',
    'Lower-body technique day plus a gentle aerobic run.',
    'Weeks 1-2 • Day 4',
    ARRAY['quads', 'glutes', 'hamstrings', 'cardio']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w12-goblet-squat",
          "name": "Goblet Squat",
          "muscle_groups": ["quads", "glutes"],
          "equipment": "Dumbbell",
          "difficulty": "beginner",
          "description": "Front-loaded squat variation to groove mechanics.",
          "instructions": ["Keep elbows close.", "Sit between hips.", "Drive up through midfoot."]
        },
        "sets": [
          { "set_number": 1, "reps": 10, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 2, "reps": 10, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 3, "reps": 10, "weight_kg": 0, "rest_seconds": 75 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w12-stepup",
          "name": "Step-Up",
          "muscle_groups": ["quads", "glutes"],
          "equipment": "Bench or Box",
          "difficulty": "beginner",
          "description": "Single-leg control and leg drive work.",
          "instructions": ["Drive through the full foot.", "Control the way down.", "Alternate legs."]
        },
        "sets": [
          { "set_number": 1, "reps": 8, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 2, "reps": 8, "weight_kg": 0, "rest_seconds": 60 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w12-glute-bridge",
          "name": "Glute Bridge",
          "muscle_groups": ["glutes", "hamstrings"],
          "equipment": "Bodyweight",
          "difficulty": "beginner",
          "description": "Posterior-chain activation and hip extension work.",
          "instructions": ["Drive hips up.", "Pause at top.", "Keep ribs down."]
        },
        "sets": [
          { "set_number": 1, "reps": 10, "weight_kg": 0, "rest_seconds": 45 },
          { "set_number": 2, "reps": 10, "weight_kg": 0, "rest_seconds": 45 },
          { "set_number": 3, "reps": 10, "weight_kg": 0, "rest_seconds": 45 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w12-easy-jog",
          "name": "Easy Jog",
          "muscle_groups": ["cardio"],
          "equipment": "Track or Treadmill",
          "difficulty": "beginner",
          "description": "Comfortable 1 to 1.5 mile run.",
          "instructions": ["Keep the pace easy enough to talk.", "Walk briefly if needed.", "Finish feeling controlled."]
        },
        "sets": [
          { "set_number": 1, "reps": 18, "weight_kg": 0, "rest_seconds": 0 }
        ]
      }
    ]'::jsonb,
    40,
    'beginner',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w1-2-d5',
    'Weeks 1-2 • Day 5 - Upper Body + Intervals',
    'Upper-body repeat day with interval running.',
    'Weeks 1-2 • Day 5',
    ARRAY['chest', 'back', 'core', 'cardio']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w12-incline-pushup-max",
          "name": "Incline Push-Up",
          "muscle_groups": ["chest", "shoulders", "triceps"],
          "equipment": "Bench or Box",
          "difficulty": "beginner",
          "description": "Build pressing endurance with max-effort sets.",
          "instructions": ["Stop 1 rep before form breaks.", "Keep body rigid.", "Track improvement over time."]
        },
        "sets": [
          { "set_number": 1, "reps": 12, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 2, "reps": 12, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 3, "reps": 12, "weight_kg": 0, "rest_seconds": 60 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w12-db-row-repeat",
          "name": "Dumbbell Row",
          "muscle_groups": ["back", "biceps"],
          "equipment": "Dumbbell",
          "difficulty": "beginner",
          "description": "Repeat pulling strength work.",
          "instructions": ["Brace hard.", "Pull smoothly.", "Lower with control."]
        },
        "sets": [
          { "set_number": 1, "reps": 10, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 2, "reps": 10, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 3, "reps": 10, "weight_kg": 0, "rest_seconds": 60 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w12-plank-25",
          "name": "Plank",
          "muscle_groups": ["core"],
          "equipment": "Bodyweight",
          "difficulty": "beginner",
          "description": "Plank endurance progression.",
          "instructions": ["Stay long through heels.", "Breathe steadily.", "Hold 25 seconds each set."]
        },
        "sets": [
          { "set_number": 1, "reps": 25, "weight_kg": 0, "rest_seconds": 45 },
          { "set_number": 2, "reps": 25, "weight_kg": 0, "rest_seconds": 45 },
          { "set_number": 3, "reps": 25, "weight_kg": 0, "rest_seconds": 45 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w12-run-intervals-repeat",
          "name": "Run Intervals",
          "muscle_groups": ["cardio"],
          "equipment": "Track or Treadmill",
          "difficulty": "beginner",
          "description": "Repeat Day 1 interval run.",
          "instructions": ["20 seconds fast jog.", "1 minute walk.", "Repeat for 6 rounds."]
        },
        "sets": [
          { "set_number": 1, "reps": 6, "weight_kg": 0, "rest_seconds": 60 }
        ]
      }
    ]'::jsonb,
    40,
    'beginner',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w1-2-d6',
    'Weeks 1-2 • Day 6 - Long Run',
    'Intro long-run day. Go slow and walk when needed.',
    'Weeks 1-2 • Day 6',
    ARRAY['cardio']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w12-long-run",
          "name": "Long Run",
          "muscle_groups": ["cardio"],
          "equipment": "Road, Track, or Treadmill",
          "difficulty": "beginner",
          "description": "1.5 to 2 miles at a slow conversational pace.",
          "instructions": ["Keep the pace easy.", "Walk if needed.", "Finish the full distance."]
        },
        "sets": [
          { "set_number": 1, "reps": 24, "weight_kg": 0, "rest_seconds": 0 }
        ]
      }
    ]'::jsonb,
    30,
    'beginner',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w3-5-d1',
    'Weeks 3-5 • Day 1 - Lower Body + Intervals',
    'Strength starts building faster. Running intervals get longer and heavier work begins.',
    'Weeks 3-5 • Day 1',
    ARRAY['quads', 'glutes', 'hamstrings', 'cardio']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w35-deadlift",
          "name": "Deadlift",
          "muscle_groups": ["hamstrings", "glutes", "back"],
          "equipment": "Barbell or Trap Bar",
          "difficulty": "beginner",
          "description": "Light to moderate strength work for ACFT prep.",
          "instructions": ["Brace before you pull.", "Drive through the floor.", "Lock out tall."]
        },
        "sets": [
          { "set_number": 1, "reps": 5, "weight_kg": 0, "rest_seconds": 120 },
          { "set_number": 2, "reps": 5, "weight_kg": 0, "rest_seconds": 120 },
          { "set_number": 3, "reps": 5, "weight_kg": 0, "rest_seconds": 120 },
          { "set_number": 4, "reps": 5, "weight_kg": 0, "rest_seconds": 120 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w35-goblet-squat",
          "name": "Goblet Squat",
          "muscle_groups": ["quads", "glutes"],
          "equipment": "Dumbbell",
          "difficulty": "beginner",
          "description": "Continue squat strength and depth development.",
          "instructions": ["Stay upright.", "Sit between hips.", "Control the descent."]
        },
        "sets": [
          { "set_number": 1, "reps": 10, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 2, "reps": 10, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 3, "reps": 10, "weight_kg": 0, "rest_seconds": 75 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w35-lunge",
          "name": "Walking Lunge",
          "muscle_groups": ["quads", "glutes", "hamstrings"],
          "equipment": "Bodyweight or Dumbbells",
          "difficulty": "beginner",
          "description": "Single-leg strength progression.",
          "instructions": ["Stay balanced.", "Control each rep.", "Perform 10 each leg."]
        },
        "sets": [
          { "set_number": 1, "reps": 10, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 2, "reps": 10, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 3, "reps": 10, "weight_kg": 0, "rest_seconds": 60 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w35-run-intervals",
          "name": "Run Intervals",
          "muscle_groups": ["cardio"],
          "equipment": "Track or Treadmill",
          "difficulty": "beginner",
          "description": "8 rounds of 30 seconds fast and 1 minute walk.",
          "instructions": ["Run hard for 30 seconds.", "Walk for 1 minute.", "Repeat for 8 rounds."]
        },
        "sets": [
          { "set_number": 1, "reps": 8, "weight_kg": 0, "rest_seconds": 60 }
        ]
      }
    ]'::jsonb,
    50,
    'beginner',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w3-5-d2',
    'Weeks 3-5 • Day 2 - Upper Body + Core',
    'Pressing moves closer to the floor and core capacity keeps improving.',
    'Weeks 3-5 • Day 2',
    ARRAY['chest', 'back', 'core']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w35-pushup",
          "name": "Push-Up",
          "muscle_groups": ["chest", "shoulders", "triceps"],
          "equipment": "Bodyweight",
          "difficulty": "beginner",
          "description": "Knee or full push-ups for max quality reps.",
          "instructions": ["Use knees if needed.", "Keep elbows under control.", "Stop before form breaks."]
        },
        "sets": [
          { "set_number": 1, "reps": 10, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 2, "reps": 10, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 3, "reps": 10, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 4, "reps": 10, "weight_kg": 0, "rest_seconds": 75 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w35-row",
          "name": "Dumbbell Row",
          "muscle_groups": ["back", "biceps"],
          "equipment": "Dumbbells",
          "difficulty": "beginner",
          "description": "Upper-back and pulling strength support.",
          "instructions": ["Drive elbow back.", "Keep torso stable.", "Use full range."]
        },
        "sets": [
          { "set_number": 1, "reps": 10, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 2, "reps": 10, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 3, "reps": 10, "weight_kg": 0, "rest_seconds": 60 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w35-plank",
          "name": "Plank",
          "muscle_groups": ["core"],
          "equipment": "Bodyweight",
          "difficulty": "beginner",
          "description": "Plank progression to 30 to 40 seconds.",
          "instructions": ["Hold 30 to 40 seconds.", "Keep glutes tight.", "Do not let low back sag."]
        },
        "sets": [
          { "set_number": 1, "reps": 30, "weight_kg": 0, "rest_seconds": 45 },
          { "set_number": 2, "reps": 35, "weight_kg": 0, "rest_seconds": 45 },
          { "set_number": 3, "reps": 40, "weight_kg": 0, "rest_seconds": 45 }
        ]
      }
    ]'::jsonb,
    35,
    'beginner',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w3-5-d3',
    'Weeks 3-5 • Day 3 - Sprint / Drag / Carry Intro',
    'Introductory ACFT-style speed, carry, and recovery work.',
    'Weeks 3-5 • Day 3',
    ARRAY['cardio', 'full_body', 'core']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w35-50m-sprint",
          "name": "50m Sprint",
          "muscle_groups": ["cardio"],
          "equipment": "Field or Track",
          "difficulty": "beginner",
          "description": "Accelerate hard over roughly 50 meters.",
          "instructions": ["Sprint about 50 meters.", "Walk back to recover.", "Repeat for 4 rounds."]
        },
        "sets": [
          { "set_number": 1, "reps": 4, "weight_kg": 0, "rest_seconds": 90 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w35-farmer-carry",
          "name": "Farmer Carry",
          "muscle_groups": ["full_body", "core"],
          "equipment": "Dumbbells or Kettlebells",
          "difficulty": "beginner",
          "description": "Moderate carry work to build grip and ACFT carry ability.",
          "instructions": ["Carry for 30 seconds each round.", "Stand tall.", "Rest 1 to 2 minutes between rounds."]
        },
        "sets": [
          { "set_number": 1, "reps": 30, "weight_kg": 0, "rest_seconds": 90 },
          { "set_number": 2, "reps": 30, "weight_kg": 0, "rest_seconds": 90 },
          { "set_number": 3, "reps": 30, "weight_kg": 0, "rest_seconds": 90 },
          { "set_number": 4, "reps": 30, "weight_kg": 0, "rest_seconds": 90 }
        ]
      }
    ]'::jsonb,
    35,
    'beginner',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w3-5-d4',
    'Weeks 3-5 • Day 4 - Lower Body + Easy Run',
    'Strength continues while aerobic capacity grows with a 2-mile easy run.',
    'Weeks 3-5 • Day 4',
    ARRAY['quads', 'glutes', 'hamstrings', 'cardio']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w35-deadlift-repeat",
          "name": "Deadlift",
          "muscle_groups": ["hamstrings", "glutes", "back"],
          "equipment": "Barbell or Trap Bar",
          "difficulty": "beginner",
          "description": "Repeat deadlift for lower-body strength development.",
          "instructions": ["Use strong setup.", "Keep bar close.", "Drive hips through at top."]
        },
        "sets": [
          { "set_number": 1, "reps": 5, "weight_kg": 0, "rest_seconds": 120 },
          { "set_number": 2, "reps": 5, "weight_kg": 0, "rest_seconds": 120 },
          { "set_number": 3, "reps": 5, "weight_kg": 0, "rest_seconds": 120 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w35-stepup",
          "name": "Step-Up",
          "muscle_groups": ["quads", "glutes"],
          "equipment": "Bench or Box",
          "difficulty": "beginner",
          "description": "Single-leg leg drive and stability.",
          "instructions": ["Perform 10 each leg.", "Drive through the whole foot.", "Stay balanced."]
        },
        "sets": [
          { "set_number": 1, "reps": 10, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 2, "reps": 10, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 3, "reps": 10, "weight_kg": 0, "rest_seconds": 60 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w35-glute-bridge",
          "name": "Glute Bridge",
          "muscle_groups": ["glutes", "hamstrings"],
          "equipment": "Bodyweight",
          "difficulty": "beginner",
          "description": "Hip extension support work.",
          "instructions": ["Pause at top.", "Keep core engaged.", "Use full hip extension."]
        },
        "sets": [
          { "set_number": 1, "reps": 12, "weight_kg": 0, "rest_seconds": 45 },
          { "set_number": 2, "reps": 12, "weight_kg": 0, "rest_seconds": 45 },
          { "set_number": 3, "reps": 12, "weight_kg": 0, "rest_seconds": 45 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w35-easy-run",
          "name": "Easy Run",
          "muscle_groups": ["cardio"],
          "equipment": "Track or Treadmill",
          "difficulty": "beginner",
          "description": "2 miles easy.",
          "instructions": ["Run at a conversational pace.", "Stay relaxed.", "Do not race the distance."]
        },
        "sets": [
          { "set_number": 1, "reps": 20, "weight_kg": 0, "rest_seconds": 0 }
        ]
      }
    ]'::jsonb,
    45,
    'beginner',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w3-5-d5',
    'Weeks 3-5 • Day 5 - Upper Body + Intervals',
    'Push-up endurance and faster repeat work start to matter more here.',
    'Weeks 3-5 • Day 5',
    ARRAY['chest', 'back', 'core', 'cardio']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w35-pushup-repeat",
          "name": "Push-Up",
          "muscle_groups": ["chest", "shoulders", "triceps"],
          "equipment": "Bodyweight",
          "difficulty": "beginner",
          "description": "4 max-effort sets of push-ups.",
          "instructions": ["Use best form possible.", "Record reps each set.", "Rest enough to repeat quality work."]
        },
        "sets": [
          { "set_number": 1, "reps": 10, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 2, "reps": 10, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 3, "reps": 10, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 4, "reps": 10, "weight_kg": 0, "rest_seconds": 75 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w35-rows",
          "name": "Dumbbell Row",
          "muscle_groups": ["back", "biceps"],
          "equipment": "Dumbbells",
          "difficulty": "beginner",
          "description": "Moderate pulling volume.",
          "instructions": ["Use 8 to 10 reps.", "Keep back flat.", "Control the lowering phase."]
        },
        "sets": [
          { "set_number": 1, "reps": 8, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 2, "reps": 9, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 3, "reps": 10, "weight_kg": 0, "rest_seconds": 60 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w35-plank-40",
          "name": "Plank",
          "muscle_groups": ["core"],
          "equipment": "Bodyweight",
          "difficulty": "beginner",
          "description": "3 sets of 40-second plank holds.",
          "instructions": ["Hold for 40 seconds.", "Stay braced.", "Breathe slowly."]
        },
        "sets": [
          { "set_number": 1, "reps": 40, "weight_kg": 0, "rest_seconds": 45 },
          { "set_number": 2, "reps": 40, "weight_kg": 0, "rest_seconds": 45 },
          { "set_number": 3, "reps": 40, "weight_kg": 0, "rest_seconds": 45 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w35-400-repeat",
          "name": "400m Repeat",
          "muscle_groups": ["cardio"],
          "equipment": "Track or Treadmill",
          "difficulty": "beginner",
          "description": "4 rounds of 400 meters or 2 minutes fast with 1 to 2 minutes rest.",
          "instructions": ["Run fast for 400m or 2 minutes.", "Rest 1 to 2 minutes.", "Repeat 4 rounds."]
        },
        "sets": [
          { "set_number": 1, "reps": 4, "weight_kg": 0, "rest_seconds": 90 }
        ]
      }
    ]'::jsonb,
    45,
    'beginner',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w3-5-d6',
    'Weeks 3-5 • Day 6 - Long Run',
    'Long aerobic build phase: 2.5 to 3 miles.',
    'Weeks 3-5 • Day 6',
    ARRAY['cardio']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w35-long-run",
          "name": "Long Run",
          "muscle_groups": ["cardio"],
          "equipment": "Road, Track, or Treadmill",
          "difficulty": "beginner",
          "description": "2.5 to 3 miles at an easy pace.",
          "instructions": ["Relax into the pace.", "Keep stride smooth.", "Finish steady, not exhausted."]
        },
        "sets": [
          { "set_number": 1, "reps": 32, "weight_kg": 0, "rest_seconds": 0 }
        ]
      }
    ]'::jsonb,
    35,
    'beginner',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w6-8-d1',
    'Weeks 6-8 • Day 1 - Lower Body + Intervals',
    'Now the training becomes more soldier-like with heavier strength and repeated 400s.',
    'Weeks 6-8 • Day 1',
    ARRAY['quads', 'glutes', 'hamstrings', 'cardio']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w68-deadlift-heavy",
          "name": "Deadlift",
          "muscle_groups": ["hamstrings", "glutes", "back"],
          "equipment": "Barbell or Trap Bar",
          "difficulty": "intermediate",
          "description": "Heavier deadlift work for ACFT strength carryover.",
          "instructions": ["Use heavier but controlled weight.", "Brace hard before each rep.", "Rest fully between sets."]
        },
        "sets": [
          { "set_number": 1, "reps": 5, "weight_kg": 0, "rest_seconds": 150 },
          { "set_number": 2, "reps": 5, "weight_kg": 0, "rest_seconds": 150 },
          { "set_number": 3, "reps": 5, "weight_kg": 0, "rest_seconds": 150 },
          { "set_number": 4, "reps": 5, "weight_kg": 0, "rest_seconds": 150 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w68-squat",
          "name": "Squat",
          "muscle_groups": ["quads", "glutes"],
          "equipment": "Barbell or Dumbbell",
          "difficulty": "intermediate",
          "description": "Strength-focused squatting.",
          "instructions": ["Use controlled depth.", "Drive up aggressively.", "Keep torso stable."]
        },
        "sets": [
          { "set_number": 1, "reps": 8, "weight_kg": 0, "rest_seconds": 90 },
          { "set_number": 2, "reps": 8, "weight_kg": 0, "rest_seconds": 90 },
          { "set_number": 3, "reps": 8, "weight_kg": 0, "rest_seconds": 90 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w68-lunge",
          "name": "Walking Lunge",
          "muscle_groups": ["quads", "glutes", "hamstrings"],
          "equipment": "Bodyweight or Dumbbells",
          "difficulty": "intermediate",
          "description": "Continue unilateral leg strength and stamina work.",
          "instructions": ["Use 10 each leg.", "Stay controlled.", "Keep posture tall."]
        },
        "sets": [
          { "set_number": 1, "reps": 10, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 2, "reps": 10, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 3, "reps": 10, "weight_kg": 0, "rest_seconds": 60 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w68-400-repeat",
          "name": "400m Repeat",
          "muscle_groups": ["cardio"],
          "equipment": "Track or Treadmill",
          "difficulty": "intermediate",
          "description": "6 rounds of 400m fast with 90 seconds rest.",
          "instructions": ["Run 400m fast.", "Rest 90 seconds.", "Repeat 6 rounds."]
        },
        "sets": [
          { "set_number": 1, "reps": 6, "weight_kg": 0, "rest_seconds": 90 }
        ]
      }
    ]'::jsonb,
    55,
    'intermediate',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w6-8-d2',
    'Weeks 6-8 • Day 2 - Upper Body + Core',
    'Push-up volume climbs and pulling strength starts approaching test demands.',
    'Weeks 6-8 • Day 2',
    ARRAY['chest', 'back', 'core']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w68-pushup",
          "name": "Push-Up",
          "muscle_groups": ["chest", "shoulders", "triceps"],
          "equipment": "Bodyweight",
          "difficulty": "intermediate",
          "description": "5 max-effort push-up sets.",
          "instructions": ["Use full reps when possible.", "Track every set.", "Rest enough to keep form solid."]
        },
        "sets": [
          { "set_number": 1, "reps": 12, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 2, "reps": 12, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 3, "reps": 12, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 4, "reps": 12, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 5, "reps": 12, "weight_kg": 0, "rest_seconds": 75 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w68-row-pullup",
          "name": "Row or Assisted Pull-Up",
          "muscle_groups": ["back", "biceps"],
          "equipment": "Dumbbells, Cable, or Pull-Up Assist",
          "difficulty": "intermediate",
          "description": "Use either rows or pull-ups based on equipment and ability.",
          "instructions": ["Choose the hardest controlled variation available.", "Aim for 8 quality reps.", "Control the lowering phase."]
        },
        "sets": [
          { "set_number": 1, "reps": 8, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 2, "reps": 8, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 3, "reps": 8, "weight_kg": 0, "rest_seconds": 75 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w68-plank",
          "name": "Plank",
          "muscle_groups": ["core"],
          "equipment": "Bodyweight",
          "difficulty": "intermediate",
          "description": "3 sets of 45 to 60 seconds.",
          "instructions": ["Stay rigid from head to heel.", "Hold 45 to 60 seconds.", "Breathe through the hold."]
        },
        "sets": [
          { "set_number": 1, "reps": 45, "weight_kg": 0, "rest_seconds": 45 },
          { "set_number": 2, "reps": 50, "weight_kg": 0, "rest_seconds": 45 },
          { "set_number": 3, "reps": 60, "weight_kg": 0, "rest_seconds": 45 }
        ]
      }
    ]'::jsonb,
    40,
    'intermediate',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w6-8-d3',
    'Weeks 6-8 • Day 3 - ACFT Conditioning',
    'Sprint, shuffle, carry, and optional sled drag practice.',
    'Weeks 6-8 • Day 3',
    ARRAY['cardio', 'full_body', 'core']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w68-acft-circuit",
          "name": "ACFT Conditioning Circuit",
          "muscle_groups": ["cardio", "full_body", "core"],
          "equipment": "Field, Dumbbells, Optional Sled",
          "difficulty": "intermediate",
          "description": "5 rounds of sprint, shuffle/backpedal, and heavy farmer carry. Add sled drag if available.",
          "instructions": ["Sprint hard.", "Shuffle or backpedal under control.", "Carry heavy with posture.", "Add sled drag if available."]
        },
        "sets": [
          { "set_number": 1, "reps": 5, "weight_kg": 0, "rest_seconds": 90 }
        ]
      }
    ]'::jsonb,
    35,
    'intermediate',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w6-8-d4',
    'Weeks 6-8 • Day 4 - Lower Body + Easy Run',
    'Shorter strength volume with easy aerobic work.',
    'Weeks 6-8 • Day 4',
    ARRAY['quads', 'glutes', 'hamstrings', 'cardio']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w68-deadlift-repeat",
          "name": "Deadlift",
          "muscle_groups": ["hamstrings", "glutes", "back"],
          "equipment": "Barbell or Trap Bar",
          "difficulty": "intermediate",
          "description": "3 sets of 5 for continued ACFT strength development.",
          "instructions": ["Keep technique crisp.", "Use moderate load.", "Own every rep."]
        },
        "sets": [
          { "set_number": 1, "reps": 5, "weight_kg": 0, "rest_seconds": 135 },
          { "set_number": 2, "reps": 5, "weight_kg": 0, "rest_seconds": 135 },
          { "set_number": 3, "reps": 5, "weight_kg": 0, "rest_seconds": 135 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w68-stepup",
          "name": "Step-Up",
          "muscle_groups": ["quads", "glutes"],
          "equipment": "Bench or Box",
          "difficulty": "intermediate",
          "description": "3 sets of 10 each leg.",
          "instructions": ["Use a stable box.", "Drive through the lead leg.", "Avoid pushing off the back foot too much."]
        },
        "sets": [
          { "set_number": 1, "reps": 10, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 2, "reps": 10, "weight_kg": 0, "rest_seconds": 60 },
          { "set_number": 3, "reps": 10, "weight_kg": 0, "rest_seconds": 60 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w68-easy-run",
          "name": "Easy Run",
          "muscle_groups": ["cardio"],
          "equipment": "Track or Treadmill",
          "difficulty": "intermediate",
          "description": "2 to 3 miles easy.",
          "instructions": ["Stay relaxed.", "Breathe rhythmically.", "Do not race the pace."]
        },
        "sets": [
          { "set_number": 1, "reps": 25, "weight_kg": 0, "rest_seconds": 0 }
        ]
      }
    ]'::jsonb,
    45,
    'intermediate',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w6-8-d5',
    'Weeks 6-8 • Day 5 - Upper Body + Speed Run',
    'Faster running and more trunk endurance.',
    'Weeks 6-8 • Day 5',
    ARRAY['chest', 'core', 'cardio']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w68-pushup-repeat",
          "name": "Push-Up",
          "muscle_groups": ["chest", "shoulders", "triceps"],
          "equipment": "Bodyweight",
          "difficulty": "intermediate",
          "description": "4 max-effort push-up sets.",
          "instructions": ["Treat each set like practice for test effort.", "Keep core tight.", "Stop only when form breaks."]
        },
        "sets": [
          { "set_number": 1, "reps": 12, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 2, "reps": 12, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 3, "reps": 12, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 4, "reps": 12, "weight_kg": 0, "rest_seconds": 75 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w68-plank-60",
          "name": "Plank",
          "muscle_groups": ["core"],
          "equipment": "Bodyweight",
          "difficulty": "intermediate",
          "description": "3 sets of 60-second plank holds.",
          "instructions": ["Own the full minute.", "Stay rigid.", "Keep hips level."]
        },
        "sets": [
          { "set_number": 1, "reps": 60, "weight_kg": 0, "rest_seconds": 45 },
          { "set_number": 2, "reps": 60, "weight_kg": 0, "rest_seconds": 45 },
          { "set_number": 3, "reps": 60, "weight_kg": 0, "rest_seconds": 45 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w68-800-repeat",
          "name": "800m Repeat",
          "muscle_groups": ["cardio"],
          "equipment": "Track or Treadmill",
          "difficulty": "intermediate",
          "description": "3 to 4 rounds of 800m with 2 minutes rest.",
          "instructions": ["Run 800m hard.", "Rest 2 minutes.", "Complete 3 to 4 rounds."]
        },
        "sets": [
          { "set_number": 1, "reps": 4, "weight_kg": 0, "rest_seconds": 120 }
        ]
      }
    ]'::jsonb,
    45,
    'intermediate',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w6-8-d6',
    'Weeks 6-8 • Day 6 - Long Run',
    'Peak aerobic base phase with 3.5 to 4.5 miles.',
    'Weeks 6-8 • Day 6',
    ARRAY['cardio']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w68-long-run",
          "name": "Long Run",
          "muscle_groups": ["cardio"],
          "equipment": "Road, Track, or Treadmill",
          "difficulty": "intermediate",
          "description": "3.5 to 4.5 miles at an easy, sustainable pace.",
          "instructions": ["Relax your shoulders.", "Stay steady.", "Finish with a little left in the tank."]
        },
        "sets": [
          { "set_number": 1, "reps": 45, "weight_kg": 0, "rest_seconds": 0 }
        ]
      }
    ]'::jsonb,
    50,
    'intermediate',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w9-10-d1',
    'Weeks 9-10 • Day 1 - ACFT Simulation',
    'Peak phase simulation day: deadlift, push-ups, sprint drills, plank, and short run.',
    'Weeks 9-10 • Day 1',
    ARRAY['full_body', 'cardio', 'core']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w910-deadlift",
          "name": "Deadlift",
          "muscle_groups": ["hamstrings", "glutes", "back"],
          "equipment": "Barbell or Trap Bar",
          "difficulty": "intermediate",
          "description": "Moderate-heavy ACFT deadlift practice.",
          "instructions": ["Warm up well.", "Use test-focused intent.", "Keep reps crisp."]
        },
        "sets": [
          { "set_number": 1, "reps": 5, "weight_kg": 0, "rest_seconds": 150 },
          { "set_number": 2, "reps": 5, "weight_kg": 0, "rest_seconds": 150 },
          { "set_number": 3, "reps": 5, "weight_kg": 0, "rest_seconds": 150 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w910-pushup-max",
          "name": "Push-Up",
          "muscle_groups": ["chest", "shoulders", "triceps"],
          "equipment": "Bodyweight",
          "difficulty": "intermediate",
          "description": "Max push-up effort under fatigue.",
          "instructions": ["Give a true hard effort.", "Count strict reps.", "Treat it like a test set."]
        },
        "sets": [
          { "set_number": 1, "reps": 15, "weight_kg": 0, "rest_seconds": 90 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w910-sprint-drills",
          "name": "Sprint Drills",
          "muscle_groups": ["cardio"],
          "equipment": "Field or Track",
          "difficulty": "intermediate",
          "description": "Short sprint efforts as part of ACFT simulation.",
          "instructions": ["Sprint hard but controlled.", "Focus on mechanics.", "Recover fully between reps."]
        },
        "sets": [
          { "set_number": 1, "reps": 6, "weight_kg": 0, "rest_seconds": 75 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w910-plank-max",
          "name": "Plank",
          "muscle_groups": ["core"],
          "equipment": "Bodyweight",
          "difficulty": "intermediate",
          "description": "Max-effort plank hold.",
          "instructions": ["Hold as long as quality allows.", "Breathe and brace.", "Track your best time."]
        },
        "sets": [
          { "set_number": 1, "reps": 90, "weight_kg": 0, "rest_seconds": 60 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w910-short-run",
          "name": "Short Run",
          "muscle_groups": ["cardio"],
          "equipment": "Track or Treadmill",
          "difficulty": "intermediate",
          "description": "Short test-prep run after simulation elements.",
          "instructions": ["Keep it honest but controlled.", "Focus on pacing under fatigue."]
        },
        "sets": [
          { "set_number": 1, "reps": 10, "weight_kg": 0, "rest_seconds": 0 }
        ]
      }
    ]'::jsonb,
    55,
    'intermediate',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w9-10-d2',
    'Weeks 9-10 • Day 2 - Recovery Run + Core',
    'Recovery-focused run day with core support work.',
    'Weeks 9-10 • Day 2',
    ARRAY['cardio', 'core']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w910-recovery-run",
          "name": "Recovery Run",
          "muscle_groups": ["cardio"],
          "equipment": "Road, Track, or Treadmill",
          "difficulty": "beginner",
          "description": "2 easy miles.",
          "instructions": ["Keep this truly easy.", "Let legs recover.", "Focus on steady breathing."]
        },
        "sets": [
          { "set_number": 1, "reps": 20, "weight_kg": 0, "rest_seconds": 0 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w910-core-circuit",
          "name": "Core Circuit",
          "muscle_groups": ["core"],
          "equipment": "Bodyweight",
          "difficulty": "beginner",
          "description": "General core circuit after the recovery run.",
          "instructions": ["Choose 2 to 3 core drills.", "Move smoothly.", "Do not turn this into a max day."]
        },
        "sets": [
          { "set_number": 1, "reps": 3, "weight_kg": 0, "rest_seconds": 45 }
        ]
      }
    ]'::jsonb,
    30,
    'beginner',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w9-10-d3',
    'Weeks 9-10 • Day 3 - Speed Work',
    'Peak speed day built around 800m repeats.',
    'Weeks 9-10 • Day 3',
    ARRAY['cardio']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w910-800-repeat",
          "name": "800m Repeat",
          "muscle_groups": ["cardio"],
          "equipment": "Track or Treadmill",
          "difficulty": "intermediate",
          "description": "4 to 5 rounds of 800m repeats.",
          "instructions": ["Run 800m hard.", "Recover enough to hold pace.", "Repeat 4 to 5 rounds."]
        },
        "sets": [
          { "set_number": 1, "reps": 5, "weight_kg": 0, "rest_seconds": 120 }
        ]
      }
    ]'::jsonb,
    40,
    'intermediate',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w9-10-d4',
    'Weeks 9-10 • Day 4 - Light Strength',
    'Lighter full-body strength day during the peak phase.',
    'Weeks 9-10 • Day 4',
    ARRAY['full_body']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w910-fullbody-strength",
          "name": "Full Body Strength Circuit",
          "muscle_groups": ["full_body"],
          "equipment": "Barbell, Dumbbells, or Machines",
          "difficulty": "beginner",
          "description": "Moderate-weight full-body lifting without high fatigue.",
          "instructions": ["Keep the weight moderate.", "Leave reps in reserve.", "Focus on good movement quality."]
        },
        "sets": [
          { "set_number": 1, "reps": 8, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 2, "reps": 8, "weight_kg": 0, "rest_seconds": 75 },
          { "set_number": 3, "reps": 8, "weight_kg": 0, "rest_seconds": 75 }
        ]
      }
    ]'::jsonb,
    35,
    'beginner',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w9-10-d5',
    'Weeks 9-10 • Day 5 - Final Hard Day',
    'Final demanding session: push-ups, sprint/drag/carry, and a fast 1-mile run.',
    'Weeks 9-10 • Day 5',
    ARRAY['full_body', 'cardio', 'core']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w910-final-pushup",
          "name": "Push-Up",
          "muscle_groups": ["chest", "shoulders", "triceps"],
          "equipment": "Bodyweight",
          "difficulty": "intermediate",
          "description": "Final hard push-up effort.",
          "instructions": ["Max effort with strict form.", "Treat it like test rehearsal."]
        },
        "sets": [
          { "set_number": 1, "reps": 15, "weight_kg": 0, "rest_seconds": 90 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w910-sdc",
          "name": "Sprint / Drag / Carry Practice",
          "muscle_groups": ["full_body", "cardio", "core"],
          "equipment": "Field, Weights, Optional Sled",
          "difficulty": "intermediate",
          "description": "ACFT sprint-drag-carry style practice.",
          "instructions": ["Sprint, drag if possible, and carry with purpose.", "Keep transitions sharp.", "Rest enough to preserve output."]
        },
        "sets": [
          { "set_number": 1, "reps": 4, "weight_kg": 0, "rest_seconds": 120 }
        ]
      },
      {
        "exercise": {
          "id": "gf-w910-fast-mile",
          "name": "1-Mile Fast Run",
          "muscle_groups": ["cardio"],
          "equipment": "Track or Treadmill",
          "difficulty": "intermediate",
          "description": "Fast 1-mile run effort.",
          "instructions": ["Push the pace.", "Stay even over the full mile.", "Treat it as a confidence rehearsal."]
        },
        "sets": [
          { "set_number": 1, "reps": 10, "weight_kg": 0, "rest_seconds": 0 }
        ]
      }
    ]'::jsonb,
    50,
    'intermediate',
    '6day',
    'custom'

  UNION ALL

  SELECT
    'gf-acft-w9-10-d6',
    'Weeks 9-10 • Day 6 - Easy Run',
    'Final easy endurance day before the test taper.',
    'Weeks 9-10 • Day 6',
    ARRAY['cardio']::text[],
    '[
      {
        "exercise": {
          "id": "gf-w910-easy-run",
          "name": "Easy Run",
          "muscle_groups": ["cardio"],
          "equipment": "Road, Track, or Treadmill",
          "difficulty": "beginner",
          "description": "2 to 3 miles relaxed.",
          "instructions": ["Stay relaxed.", "Do not force the pace.", "Use this to recover and stay sharp."]
        },
        "sets": [
          { "set_number": 1, "reps": 25, "weight_kg": 0, "rest_seconds": 0 }
        ]
      }
    ]'::jsonb,
    30,
    'beginner',
    '6day',
    'custom'
)
INSERT INTO workout_templates (
  id,
  user_id,
  name,
  description,
  day_label,
  muscle_groups,
  exercises,
  estimated_duration_min,
  difficulty,
  split_type,
  source
)
SELECT
  plan_rows.id,
  target_profile.id,
  plan_rows.name,
  plan_rows.description,
  plan_rows.day_label,
  plan_rows.muscle_groups,
  plan_rows.exercises,
  plan_rows.estimated_duration_min,
  plan_rows.difficulty,
  plan_rows.split_type,
  plan_rows.source
FROM plan_rows
JOIN target_profile ON TRUE
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  day_label = EXCLUDED.day_label,
  muscle_groups = EXCLUDED.muscle_groups,
  exercises = EXCLUDED.exercises,
  estimated_duration_min = EXCLUDED.estimated_duration_min,
  difficulty = EXCLUDED.difficulty,
  split_type = EXCLUDED.split_type,
  source = EXCLUDED.source,
  updated_at = NOW();
