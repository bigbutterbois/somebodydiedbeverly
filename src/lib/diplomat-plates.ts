import { supabase, supabaseAdmin } from './supabase'

export function normalizeCountryName(name: string): string {
  if (!name) return ''
  // Resolve pipe notation — take the last segment (e.g. 'Republic of Macedonia|Macedonia' → 'North Macedonia')
  // Special case: known pipe aliases
  let result = name
  const pipeAliases: Record<string, string> = {
    'Republic of Macedonia|Macedonia': 'North Macedonia',
  }
  if (pipeAliases[result]) return pipeAliases[result]
  // For any remaining pipe notation, take the part after the last pipe
  if (result.includes('|')) {
    result = result.split('|').pop() ?? result
  }
  // Strip parenthetical suffixes like (DC only), (UN only), (Burma), etc.
  result = result.replace(/\s*\([^)]*\)/g, '')
  return result.trim()
}

export interface Country {
  id: string
  country_name: string
  country_code: string
}

export interface Sighting {
  id: string
  country_id: string
  country_name: string
  date_spotted: string
  notes: string | null
  created_at: string
}

export interface CountryWithStatus extends Country {
  spotted: boolean
}

export async function getCountries(): Promise<Country[]> {
  const { data, error } = await supabase
    .from('countries')
    .select('id, country_name, country_code')
    .order('country_name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function getSightings(): Promise<Sighting[]> {
  const { data, error } = await supabase
    .from('plate_sightings')
    .select('id, country_id, date_spotted, notes, created_at, countries(country_name)')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((s: Record<string, unknown>) => ({
    id: s.id as string,
    country_id: s.country_id as string,
    country_name: ((s.countries as Record<string, string> | null)?.country_name) ?? '',
    date_spotted: s.date_spotted as string,
    notes: s.notes as string | null,
    created_at: s.created_at as string,
  }))
}

export async function getCountryChecklist(): Promise<CountryWithStatus[]> {
  const { data: countries, error: cErr } = await supabase
    .from('countries')
    .select('id, country_name, country_code')
    .order('country_name', { ascending: true })

  if (cErr) throw cErr

  const { data: sightings, error: sErr } = await supabase
    .from('plate_sightings')
    .select('country_id')

  if (sErr) throw sErr

  const spottedIds = new Set((sightings ?? []).map((s: Record<string, string>) => s.country_id))

  // Normalize names and deduplicate — two rows that collapse to the same name
  // merge into one entry where spotted=true if either source row was spotted.
  const seen = new Map<string, CountryWithStatus>()
  for (const c of (countries ?? []) as Record<string, string>[]) {
    const normalizedName = normalizeCountryName(c.country_name)
    const isSpotted = spottedIds.has(c.id)
    const existing = seen.get(normalizedName)
    if (existing) {
      if (isSpotted) existing.spotted = true
    } else {
      seen.set(normalizedName, {
        id: c.id,
        country_name: normalizedName,
        country_code: c.country_code,
        spotted: isSpotted,
      })
    }
  }
  return Array.from(seen.values())
}

export async function logSighting(params: {
  country_id: string
  date_spotted: string
  notes?: string | null
}): Promise<Sighting> {
  const { data: raw, error } = await supabaseAdmin
    .from('plate_sightings')
    .insert({
      country_id: params.country_id,
      date_spotted: params.date_spotted,
      notes: params.notes ?? null,
    })
    .select('id, country_id, date_spotted, notes, created_at, countries(country_name)')
    .single()

  if (error) throw error

  const r = raw as Record<string, unknown>
  return {
    id: r.id as string,
    country_id: r.country_id as string,
    country_name: ((r.countries as Record<string, string> | null)?.country_name) ?? '',
    date_spotted: r.date_spotted as string,
    notes: r.notes as string | null,
    created_at: r.created_at as string,
  }
}

export async function updateSighting(
  id: string,
  updates: { date_spotted?: string; notes?: string | null }
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('plate_sightings')
    .update(updates)
    .eq('id', id)

  if (error) throw error
}

export async function deleteSighting(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('plate_sightings').delete().eq('id', id)
  if (error) throw error
}
