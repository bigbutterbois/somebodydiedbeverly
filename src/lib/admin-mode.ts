'use client'

const ADMIN_MODE_KEY = 'sdb_admin_mode'

export function getAdminMode(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(ADMIN_MODE_KEY) === 'true'
}

export function setAdminMode(active: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ADMIN_MODE_KEY, String(active))
}

export function toggleAdminMode(): boolean {
  const next = !getAdminMode()
  setAdminMode(next)
  return next
}
