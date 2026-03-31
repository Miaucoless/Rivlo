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
    .replace(/([A-Za-z])\s*\n\s*(\d)/g, '$1 $2')
    .replace(/(\d)\s*\n\s*([A-Za-z])/g, '$1 $2')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeOcrDigits(value: string) {
  return value
    .replace(/([0-9])[Oo]/g, '$10')
    .replace(/[Oo](?=[0-9])/g, '0')
    .replace(/([0-9])[Il]/g, '$11')
    .replace(/[Il](?=[0-9])/g, '1')
    .replace(/(\d)\s+(?=\d)/g, '$1')
}

function getLines(text: string) {
  return text
    .split('\n')
    .map((line) => normalizeOcrDigits(line.trim()))
    .filter(Boolean)
}

function extractFirstNumericToken(value: string) {
  const normalized = normalizeOcrDigits(value)
  const match = normalized.match(/(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?)/)
  return match?.[1]
}

function findValueInLines(lines: string[], labelPatterns: RegExp[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!labelPatterns.some((pattern) => pattern.test(line))) continue

    const inlineValue = extractFirstNumericToken(line.replace(/^[^0-9]*/, ''))
    const parsedInline = parseNumber(inlineValue)
    if (parsedInline !== null) return parsedInline

    const nextLine = lines[index + 1]
    const parsedNextLine = parseNumber(extractFirstNumericToken(nextLine || '') || undefined)
    if (parsedNextLine !== null) return parsedNextLine
  }

  return null
}

function findValue(text: string, patterns: RegExp[], linePatterns: RegExp[] = []) {
  const normalizedText = normalizeOcrDigits(text)

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern)
    const parsed = parseNumber(match?.[1] ? normalizeOcrDigits(match[1]) : undefined)
    if (parsed !== null) return parsed
  }

  if (linePatterns.length > 0) {
    const parsedFromLines = findValueInLines(getLines(normalizedText), linePatterns)
    if (parsedFromLines !== null) return parsedFromLines
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
    /calories[^0-9]{0,8}(\d+(?:[.,]\d+)?(?:\s+\d+)*)/i,
    /energy[^0-9]{0,8}(\d+(?:[.,]\d+)?(?:\s+\d+)*)/i,
  ], [
    /\bcalories\b/i,
    /\benergy\b/i,
  ])
  const protein = findValue(text, [
    /protein[^0-9]{0,12}(\d+(?:[.,]\d+)?)/i,
  ], [
    /\bprotein\b/i,
  ])
  const carbs = findValue(text, [
    /total\s+carbohydrate[^0-9]{0,12}(\d+(?:[.,]\d+)?)/i,
    /carbohydrate[^0-9]{0,12}(\d+(?:[.,]\d+)?)/i,
    /carbs?[^0-9]{0,12}(\d+(?:[.,]\d+)?)/i,
  ], [
    /total\s+carbohydrate/i,
    /\bcarbohydrate\b/i,
    /\bcarbs?\b/i,
  ])
  const fat = findValue(text, [
    /total\s+fat[^0-9]{0,12}(\d+(?:[.,]\d+)?)/i,
    /\bfat[^0-9]{0,12}(\d+(?:[.,]\d+)?)/i,
  ], [
    /total\s+fat/i,
    /\bfat\b/i,
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
