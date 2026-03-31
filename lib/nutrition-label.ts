import type { BarcodeFoodLookupResult } from '@/lib/barcode-food'

type ServingMeta = {
  label: string
  amount: number
  unit: string
}

function parseNumber(value: string | undefined) {
  if (!value) return null
  const parsed = Number(value.replace(',', '.').trim())
  return Number.isFinite(parsed) ? parsed : null
}

function roundMacro(value: number) {
  return Math.round(value * 10) / 10
}

function sanitizeText(value: string) {
  return value
    .replace(/\r/g, '\n')
    .replace(/[|]/g, 'I')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function findValue(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const parsed = parseNumber(match?.[1])
    if (parsed !== null) return parsed
  }
  return null
}

function parseServingMeta(rawLabel: string | null): ServingMeta {
  const label = rawLabel?.trim() || '1 serving'
  const parentheticalMatch = label.match(/\((\d+(?:[.,]\d+)?)\s*(g|ml|oz|fl oz)\)/i)
  const primaryMatch = label.match(/(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?)\s*(g|gram|grams|ml|milliliter|milliliters|oz|fl oz|cup|cups|tbsp|tsp|piece|pieces|slice|slices|serving|servings)\b/i)

  const preferred = parentheticalMatch ?? primaryMatch
  if (!preferred) {
    return { label, amount: 1, unit: 'serving' }
  }

  const rawAmount = preferred[1]
  const fractionMatch = rawAmount.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/)
  const amount = fractionMatch
    ? (parseNumber(fractionMatch[1]) ?? 1) / Math.max(parseNumber(fractionMatch[2]) ?? 1, 1)
    : parseNumber(rawAmount) ?? 1

  const unit = preferred[2].toLowerCase()
  return { label, amount, unit }
}

function extractServingLabel(text: string) {
  const lineMatch = text.match(/serving\s*size\s*[:\-]?\s*([^\n]+)/i)
  if (lineMatch?.[1]) return lineMatch[1].trim()

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const servingLine = lines.find((line) => /serving\s*size/i.test(line))
  if (!servingLine) return null

  return servingLine.replace(/serving\s*size\s*[:\-]?\s*/i, '').trim() || null
}

function extractFoodName(text: string) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/nutrition\s+facts/i.test(line))
    .filter((line) => !/^amount per serving$/i.test(line))
    .filter((line) => !/^serving size/i.test(line))
    .filter((line) => !/^calories\b/i.test(line))

  const candidate = lines.find((line) => {
    if (line.length < 3 || line.length > 60) return false
    if (/\d{3,}/.test(line)) return false
    if (/(total fat|protein|carbohydrate|sodium|cholesterol|dietary fiber|sugars|added sugars)/i.test(line)) return false
    return /^[a-z0-9][a-z0-9 '&/()+.,-]+$/i.test(line)
  })

  return candidate || 'Scanned Nutrition Label'
}

export function parseNutritionLabelText(rawText: string): BarcodeFoodLookupResult | null {
  const text = sanitizeText(rawText)
  if (!text) return null

  const calories = findValue(text, [
    /calories\s+(\d+(?:[.,]\d+)?)/i,
    /energy\s+(\d+(?:[.,]\d+)?)/i,
  ])
  const protein = findValue(text, [
    /protein\s+(\d+(?:[.,]\d+)?)/i,
  ])
  const carbs = findValue(text, [
    /total\s+carbohydrate\s+(\d+(?:[.,]\d+)?)/i,
    /carbohydrate\s+(\d+(?:[.,]\d+)?)/i,
    /carbs?\s+(\d+(?:[.,]\d+)?)/i,
  ])
  const fat = findValue(text, [
    /total\s+fat\s+(\d+(?:[.,]\d+)?)/i,
    /\bfat\s+(\d+(?:[.,]\d+)?)/i,
  ])

  if (calories === null && protein === null && carbs === null && fat === null) {
    return null
  }

  const servingMeta = parseServingMeta(extractServingLabel(text))

  return {
    barcode: null,
    name: extractFoodName(text),
    brand: null,
    image_url: null,
    serving_label: servingMeta.label,
    serving_amount: servingMeta.amount,
    serving_unit: servingMeta.unit,
    macros: {
      calories: Math.round(calories ?? 0),
      protein_g: roundMacro(protein ?? 0),
      carbs_g: roundMacro(carbs ?? 0),
      fat_g: roundMacro(fat ?? 0),
    },
    source: 'nutrition_label_ocr',
    raw_text: text,
  }
}
