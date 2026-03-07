/**
 * One-time script to seed the countries table from diplomatCodes.ts
 * Run with: npx tsx --env-file=.env.local scripts/seed-countries.ts
 */

import { createClient } from '@supabase/supabase-js'
import { diplomatCodes } from '../src/data/diplomatCodes'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// base country entries have no role suffix — filter out variants
const SUFFIXES = [' Consul', ' Diplomat', ' Staff', ' UN Diplomat']

const baseEntries = diplomatCodes.filter(
  (entry) => !SUFFIXES.some((suffix) => entry.country.endsWith(suffix))
)

// deduplicate by country name (keep first occurrence)
const seen = new Set<string>()
const unique = baseEntries.filter((entry) => {
  if (seen.has(entry.country)) return false
  seen.add(entry.country)
  return true
})

const rows = unique.map((entry) => ({
  country_name: entry.country,
  country_code: entry.code,
}))

async function main() {
  console.log(`seeding ${rows.length} countries…`)

  const { error } = await supabase.from('countries').insert(rows)

  if (error) {
    console.error('seed failed:', error.message)
    process.exit(1)
  }

  console.log(`done. ${rows.length} countries inserted.`)
}

main()
