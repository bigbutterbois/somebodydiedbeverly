import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getCountryChecklist } from '@/lib/diplomat-plates'
import PageWrapper from '@/components/ui/PageWrapper'
import DiplomatLookup from './DiplomatLookup'

export const dynamic = 'force-dynamic'

export default async function DiplomatPlatesPage() {
  const session = await auth()
  const checklist = await getCountryChecklist()

  const spottedCount = checklist.filter((c) => c.spotted).length
  const totalCount = checklist.length

  return (
    <PageWrapper variant="light" width="blog">
      <div className="flex items-baseline justify-between mb-12">
        <span className="text-[10.5px] tracking-[0.12em] text-accent">diplomat plates</span>
        {session && (
          <Link
            href="/admin/diplomat-plates"
            className="text-[10.5px] text-light-muted tracking-[0.08em] no-underline transition-colors duration-150 hover:text-accent"
          >
            log sighting →
          </Link>
        )}
      </div>

      <DiplomatLookup />

      {/* country checklist */}
      {checklist.length > 0 && (
        <div className="mt-16 flex flex-col gap-0">
          <div className="flex items-baseline gap-4 mb-6">
            <span className="text-[10.5px] tracking-[0.10em] text-light-muted">countries</span>
            <span className="text-[10.5px] tracking-[0.06em] text-accent">
              {spottedCount} of {totalCount} spotted
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
            {checklist.map((c) => (
              <span
                key={c.id}
                className={`text-[11.5px] tracking-[0.01em] ${
                  c.spotted ? 'text-light-primary' : 'text-light-muted'
                }`}
              >
                {c.spotted ? '· ' : ''}{c.country_name}
              </span>
            ))}
          </div>
        </div>
      )}
    </PageWrapper>
  )
}
