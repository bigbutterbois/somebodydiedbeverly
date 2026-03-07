import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { getCountries, getSightings } from '@/lib/diplomat-plates'
import AdminDiplomatClient from './AdminDiplomatClient'

export const dynamic = 'force-dynamic'

export default async function AdminDiplomatPlatesPage() {
  const session = await auth()
  if (!session) notFound()

  const [countries, sightings] = await Promise.all([getCountries(), getSightings()])
  return <AdminDiplomatClient countries={countries} initialSightings={sightings} />
}
