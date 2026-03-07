'use client'

import { useState, useEffect } from 'react'
import type { Country, Sighting } from '@/lib/diplomat-plates'

interface Props {
  countries: Country[]
  initialSightings: Sighting[]
}

export default function AdminDiplomatClient({ countries, initialSightings }: Props) {
  const [sightings, setSightings] = useState(initialSightings)
  const [countryId, setCountryId] = useState('')
  const [dateSpotted, setDateSpotted] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDateSpotted(new Date().toISOString().slice(0, 10))
  }, [])

  async function handleLog() {
    if (!countryId || !dateSpotted) {
      setError('country and date are required')
      return
    }
    setError('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/diplomat-plates/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country_id: countryId, date_spotted: dateSpotted, notes: notes || null }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'failed to log')
        return
      }

      const newSighting: Sighting = await res.json()
      setSightings((prev) => [newSighting, ...prev])
      setCountryId('')
      setNotes('')
      setDateSpotted(new Date().toISOString().slice(0, 10))
    } catch {
      setError('something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('delete this sighting?')) return
    try {
      await fetch('/api/diplomat-plates/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setSightings((prev) => prev.filter((s) => s.id !== id))
    } catch {
      setError('delete failed')
    }
  }

  async function handleEditSave(id: string) {
    if (!editDate) return
    setSaving(true)
    try {
      const res = await fetch('/api/diplomat-plates/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, date_spotted: editDate, notes: editNotes || null }),
      })
      if (!res.ok) return
      setSightings((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, date_spotted: editDate, notes: editNotes || null } : s
        )
      )
      setEditingId(null)
    } catch {
      setError('update failed')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'bg-[#1c1c1a] border border-border-dark text-text-primary font-sans text-[12px] tracking-[0.02em] px-3 py-2 outline-none transition-colors duration-150 focus:border-accent placeholder:text-text-muted'

  return (
    <div className="min-h-screen bg-charcoal">
      {/* header */}
      <div className="border-b border-border-dark px-6 sm:px-10 h-[52px] flex items-center justify-between bg-nav-bg">
        <span className="text-[12px] text-text-secondary tracking-[0.04em]">diplomat plates</span>
        <a
          href="/diplomat-plates"
          className="text-[11px] text-text-muted tracking-[0.04em] no-underline hover:text-text-primary transition-colors duration-150"
        >
          ← diplomat plates
        </a>
      </div>

      <div className="max-w-lg mx-auto px-6 sm:px-10 pt-10 pb-24 flex flex-col gap-8">
        {/* log form */}
        <div className="flex flex-col gap-4">
          <span className="text-[10.5px] text-text-muted tracking-[0.08em]">log sighting</span>

          <select
            value={countryId}
            onChange={(e) => setCountryId(e.target.value)}
            className={`${inputClass} w-full`}
          >
            <option value="">select country</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.country_name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateSpotted}
            onChange={(e) => setDateSpotted(e.target.value)}
            className={`${inputClass} w-full`}
          />

          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="notes (optional)"
            className={`${inputClass} w-full`}
          />

          <button
            onClick={handleLog}
            disabled={submitting}
            className="self-start text-[11px] text-text-muted border border-border-dark px-4 py-2 tracking-[0.04em] hover:text-text-primary hover:border-text-muted transition-colors duration-150 disabled:opacity-50"
          >
            {submitting ? 'logging…' : 'log'}
          </button>
        </div>

        {error && <p className="text-[11px] text-[#b84040] tracking-[0.03em]">{error}</p>}

        {/* sightings list */}
        <div className="border-t border-border-dark pt-8 flex flex-col gap-4">
          <span className="text-[10.5px] text-text-muted tracking-[0.08em]">
            {sightings.length > 0 ? `all sightings (${sightings.length})` : 'no sightings yet'}
          </span>

          <div className="flex flex-col gap-px">
            {sightings.map((s) => (
              <div key={s.id} className="border border-border-dark p-4 bg-[#1a1a18] flex flex-col gap-2">
                {editingId === s.id ? (
                  <>
                    <p className="text-[12px] text-text-secondary tracking-[0.02em]">
                      {s.country_name}
                    </p>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className={`${inputClass} w-full`}
                    />
                    <input
                      type="text"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="notes"
                      className={`${inputClass} w-full`}
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleEditSave(s.id)}
                        disabled={saving}
                        className="text-[11px] text-text-muted tracking-[0.04em] hover:text-text-primary transition-colors duration-150 disabled:opacity-50"
                      >
                        {saving ? 'saving…' : 'save'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-[11px] text-text-muted tracking-[0.04em] hover:text-text-primary transition-colors duration-150"
                      >
                        cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-[12px] text-text-primary tracking-[0.02em]">
                        {s.country_name}
                      </span>
                      <span className="text-[11px] text-text-muted tracking-[0.03em] flex-shrink-0">
                        {s.date_spotted}
                      </span>
                    </div>
                    {s.notes && (
                      <p className="text-[11px] text-text-muted tracking-[0.03em]">{s.notes}</p>
                    )}
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setEditingId(s.id)
                          setEditDate(s.date_spotted)
                          setEditNotes(s.notes ?? '')
                        }}
                        className="text-[11px] text-text-muted tracking-[0.04em] hover:text-text-primary transition-colors duration-150"
                      >
                        edit
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="text-[11px] text-[#b84040] tracking-[0.04em] hover:text-[#d45050] transition-colors duration-150"
                      >
                        delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
