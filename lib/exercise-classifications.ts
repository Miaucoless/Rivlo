import type { ExerciseModifier, ExercisePrimaryType } from '@/types'

interface ExerciseClassification {
  primary_type: ExercisePrimaryType
  modifiers?: ExerciseModifier[]
}

export const EXERCISE_CLASSIFICATIONS: Record<string, ExerciseClassification> = {
  // ── Chest ──────────────────────────────────────────────────────────────────
  'lib-bench-barbell-flat':        { primary_type: 'strength' },
  'lib-bench-dumbbell-flat':       { primary_type: 'strength' },
  'lib-bench-barbell-incline':     { primary_type: 'strength' },
  'lib-bench-dumbbell-incline':    { primary_type: 'strength' },
  'lib-bench-machine-incline':     { primary_type: 'strength' },
  'lib-pushup':                    { primary_type: 'bodyweight' },
  'lib-cable-fly':                 { primary_type: 'strength' },
  'lib-pec-deck':                  { primary_type: 'strength' },
  'lib-dips':                      { primary_type: 'bodyweight', modifiers: ['weighted'] },
  'lib-smith-bench':               { primary_type: 'strength' },
  'lib-smith-incline-chest-press': { primary_type: 'strength' },
  'lib-smith-decline-chest-press': { primary_type: 'strength' },
  'lib-decline-bench':             { primary_type: 'strength' },
  'lib-decline-db-press':          { primary_type: 'strength' },
  'lib-landmine-press':            { primary_type: 'strength' },
  'lib-low-to-high-cable-fly':     { primary_type: 'strength' },
  'lib-machine-chest-press':       { primary_type: 'strength' },
  'lib-jm-press':                  { primary_type: 'strength' },

  // ── Shoulders ─────────────────────────────────────────────────────────────
  'lib-overhead-barbell':          { primary_type: 'strength' },
  'lib-overhead-dumbbell':         { primary_type: 'strength' },
  'lib-lateral-raise':             { primary_type: 'strength' },
  'lib-machine-shoulder-press':    { primary_type: 'strength' },
  'lib-arnold-press':              { primary_type: 'strength' },
  'lib-face-pull':                 { primary_type: 'strength' },
  'lib-rear-delt-fly':             { primary_type: 'strength' },
  'lib-leaning-lateral-raise':     { primary_type: 'strength', modifiers: ['unilateral'] },
  'lib-upright-row':               { primary_type: 'strength' },
  'lib-shrug-db':                  { primary_type: 'strength' },
  'lib-shrug-barbell':             { primary_type: 'strength' },
  'lib-cuban-press':               { primary_type: 'strength' },
  'lib-cable-front-raise':         { primary_type: 'strength' },

  // ── Back ──────────────────────────────────────────────────────────────────
  'lib-row-barbell':               { primary_type: 'strength' },
  'lib-row-cable':                 { primary_type: 'strength' },
  'lib-row-dumbbell-single':       { primary_type: 'strength', modifiers: ['unilateral'] },
  'lib-lat-pulldown':              { primary_type: 'strength' },
  'lib-pullup':                    { primary_type: 'bodyweight', modifiers: ['weighted'] },
  'lib-tbar-row':                  { primary_type: 'strength' },
  'lib-chest-supported-row':       { primary_type: 'strength' },
  'lib-straight-arm-pulldown':     { primary_type: 'strength' },
  'lib-dumbbell-pullover':         { primary_type: 'strength' },
  'lib-underhand-row':             { primary_type: 'strength' },
  'lib-meadows-row':               { primary_type: 'strength', modifiers: ['unilateral'] },
  'lib-single-arm-lat-pulldown':   { primary_type: 'strength', modifiers: ['unilateral'] },
  'lib-machine-pullover':          { primary_type: 'strength' },
  'lib-seal-row':                  { primary_type: 'strength' },
  'lib-inverted-row':              { primary_type: 'bodyweight' },
  'lib-assisted-pull-up':          { primary_type: 'bodyweight', modifiers: ['assisted'] },
  'lib-wide-grip-lat-pulldown':    { primary_type: 'strength' },
  'lib-close-grip-lat-pulldown':   { primary_type: 'strength' },

  // ── Hinge / Deadlift ──────────────────────────────────────────────────────
  'lib-deadlift':                  { primary_type: 'strength' },
  'lib-rdl':                       { primary_type: 'strength' },
  'lib-rdl-barbell':               { primary_type: 'strength' },
  'lib-rdl-dumbbells':             { primary_type: 'strength' },
  'lib-rdl-bodyweight':            { primary_type: 'strength' },
  'lib-good-morning':              { primary_type: 'strength' },
  'lib-sumo-deadlift':             { primary_type: 'strength' },
  'lib-trap-bar-deadlift':         { primary_type: 'strength' },

  // ── Squat / Leg Press ─────────────────────────────────────────────────────
  'lib-squat-back':                { primary_type: 'strength' },
  'lib-squat-front':               { primary_type: 'strength' },
  'lib-leg-press':                 { primary_type: 'strength' },
  'lib-hack-squat':                { primary_type: 'strength' },
  'lib-goblet-squat':              { primary_type: 'strength' },
  'lib-smith-squat':               { primary_type: 'strength' },
  'lib-pendulum-squat':            { primary_type: 'strength' },
  'lib-zercher-squat':             { primary_type: 'strength' },
  'lib-sissy-squat':               { primary_type: 'bodyweight' },

  // ── Unilateral Legs ───────────────────────────────────────────────────────
  'lib-lunge-walking':             { primary_type: 'strength', modifiers: ['unilateral', 'alternating'] },
  'lib-walking-lunge-db':          { primary_type: 'strength', modifiers: ['unilateral', 'alternating'] },
  'lib-bulgarian-split-squat':     { primary_type: 'strength', modifiers: ['unilateral'] },
  'lib-step-up':                   { primary_type: 'strength', modifiers: ['unilateral'] },
  'lib-reverse-lunge':             { primary_type: 'strength', modifiers: ['unilateral'] },
  'lib-curtsy-lunge':              { primary_type: 'strength', modifiers: ['unilateral'] },

  // ── Hamstrings / Glutes ───────────────────────────────────────────────────
  'lib-leg-curl':                  { primary_type: 'strength' },
  'lib-lying-leg-curl':            { primary_type: 'strength' },
  'lib-leg-extension':             { primary_type: 'strength' },
  'lib-hip-thrust':                { primary_type: 'strength' },
  'lib-glute-bridge':              { primary_type: 'bodyweight', modifiers: ['weighted'] },
  'lib-nordic-curl':               { primary_type: 'bodyweight' },
  'lib-glute-ham-raise':           { primary_type: 'bodyweight' },

  // ── Calves ────────────────────────────────────────────────────────────────
  'lib-calf-raise':                { primary_type: 'strength' },
  'lib-seated-calf-raise':         { primary_type: 'strength' },
  'lib-single-leg-calf-raise':     { primary_type: 'bodyweight', modifiers: ['unilateral'] },

  // ── Biceps ────────────────────────────────────────────────────────────────
  'lib-curl-barbell':              { primary_type: 'strength' },
  'lib-curl-hammer':               { primary_type: 'strength' },
  'lib-preacher-curl':             { primary_type: 'strength' },
  'lib-cable-curl':                { primary_type: 'strength' },
  'lib-incline-db-curl':           { primary_type: 'strength' },
  'lib-concentration-curl':        { primary_type: 'strength', modifiers: ['unilateral'] },
  'lib-spider-curl':               { primary_type: 'strength' },
  'lib-reverse-curl':              { primary_type: 'strength' },
  'lib-cross-body-hammer-curl':    { primary_type: 'strength', modifiers: ['unilateral', 'alternating'] },

  // ── Triceps ───────────────────────────────────────────────────────────────
  'lib-triceps-pushdown':              { primary_type: 'strength' },
  'lib-skullcrusher':                  { primary_type: 'strength' },
  'lib-overhead-tricep-extension':     { primary_type: 'strength' },
  'lib-close-grip-bench':              { primary_type: 'strength' },
  'lib-tricep-kickback':               { primary_type: 'strength', modifiers: ['unilateral'] },
  'lib-cable-overhead-tricep-extension': { primary_type: 'strength' },
  'lib-seated-dip-machine':           { primary_type: 'strength' },

  // ── Core ──────────────────────────────────────────────────────────────────
  'lib-crunch-cable':              { primary_type: 'strength' },
  'lib-plank':                     { primary_type: 'bodyweight', modifiers: ['time_cap', 'weighted'] },
  'lib-hanging-leg-raise':         { primary_type: 'bodyweight' },
  'lib-ab-wheel':                  { primary_type: 'bodyweight' },
  'lib-russian-twist':             { primary_type: 'bodyweight' },
  'lib-bicycle-crunch':            { primary_type: 'bodyweight', modifiers: ['alternating'] },
  'lib-reverse-crunch':            { primary_type: 'bodyweight' },
  'lib-weighted-decline-sit-up':   { primary_type: 'strength' },
  'lib-copenhagen-plank':          { primary_type: 'bodyweight', modifiers: ['unilateral', 'time_cap'] },
  'lib-side-plank':                { primary_type: 'bodyweight', modifiers: ['unilateral', 'time_cap'] },
  'lib-dead-bug':                  { primary_type: 'bodyweight' },
  'lib-pallof-press':              { primary_type: 'strength', modifiers: ['unilateral'] },

  // ── Sprint ────────────────────────────────────────────────────────────────
  'lib-sprint':                    { primary_type: 'intervals', modifiers: ['interval_structure', 'rounds'] },

  // ── Treadmill cardio ──────────────────────────────────────────────────────
  'lib-run-treadmill':             { primary_type: 'time_distance' },
  'lib-walk-treadmill':            { primary_type: 'time_distance' },

  // ── Outdoor cardio ────────────────────────────────────────────────────────
  'lib-run-outdoor':               { primary_type: 'distance' },
  'lib-walk-outdoor':              { primary_type: 'distance' },
  'lib-hiking':                    { primary_type: 'distance' },

  // ── Machine cardio ────────────────────────────────────────────────────────
  'lib-stairmaster':               { primary_type: 'time' },
  'lib-elliptical':                { primary_type: 'time' },
  'lib-rowing-machine':            { primary_type: 'time' },
  'lib-stationary-bike':           { primary_type: 'time' },
  'lib-swimming-laps':             { primary_type: 'time' },
  'lib-assault-runner':            { primary_type: 'time' },
  'lib-ski-erg':                   { primary_type: 'time' },
  'lib-versa-climber':             { primary_type: 'time' },

  // ── Intervals ─────────────────────────────────────────────────────────────
  'lib-bike':                      { primary_type: 'intervals', modifiers: ['interval_structure'] },
  'lib-row-intervals':             { primary_type: 'intervals', modifiers: ['interval_structure', 'rounds'] },
  'lib-battle-ropes':              { primary_type: 'intervals', modifiers: ['interval_structure', 'rounds'] },
  'lib-shadow-boxing':             { primary_type: 'intervals', modifiers: ['rounds'] },

  // ── Conditioning / Mixed ──────────────────────────────────────────────────
  'lib-burpees':                   { primary_type: 'bodyweight', modifiers: ['rounds'] },
  'lib-mountain-climbers':         { primary_type: 'bodyweight' },
  'lib-box-jumps':                 { primary_type: 'bodyweight', modifiers: ['rounds'] },
  'lib-jump-rope':                 { primary_type: 'mixed', modifiers: ['interval_structure'] },
  'lib-kettlebell-swing':          { primary_type: 'mixed', modifiers: ['interval_structure'] },
  'lib-kettlebell-swing-intervals': { primary_type: 'intervals', modifiers: ['interval_structure', 'rounds'] },
  'lib-kettlebell-clean':          { primary_type: 'strength' },
  'lib-kettlebell-clean-intervals': { primary_type: 'intervals', modifiers: ['interval_structure', 'rounds'] },
  'lib-kettlebell-snatch':         { primary_type: 'strength' },
  'lib-kettlebell-snatch-intervals': { primary_type: 'intervals', modifiers: ['interval_structure', 'rounds'] },
  'lib-kettlebell-press':          { primary_type: 'strength' },
  'lib-kettlebell-row':            { primary_type: 'strength', modifiers: ['unilateral'] },
  'lib-turkish-get-up':            { primary_type: 'strength', modifiers: ['unilateral'] },
  'lib-goblet-squat-kettlebell':   { primary_type: 'strength' },
  'lib-sled-push':                 { primary_type: 'mixed', modifiers: ['distance_based'] },
  'lib-sled-pull':                 { primary_type: 'mixed', modifiers: ['distance_based'] },
  'lib-farmer-carry':              { primary_type: 'mixed', modifiers: ['distance_based'] },
  'lib-bear-crawl':                { primary_type: 'mixed', modifiers: ['distance_based'] },
  'lib-jumping-jacks':             { primary_type: 'bodyweight' },

  // ── Yoga / Pilates ───────────────────────────────────────────────────────
  'lib-yoga-vinyasa':              { primary_type: 'time' },
  'lib-yoga-hatha':                { primary_type: 'time' },
  'lib-yoga-yin':                  { primary_type: 'time' },
  'lib-pilates-mat':               { primary_type: 'time' },
  'lib-pilates-reformer':          { primary_type: 'time' },
}
