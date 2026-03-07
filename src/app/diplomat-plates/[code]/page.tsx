import Link from 'next/link'
import PageWrapper from '@/components/ui/PageWrapper'
import { lookupCode } from '@/data/diplomatCodes'

interface Props {
  params: Promise<{ code: string }>
}

export default async function DiplomatResultPage({ params }: Props) {
  const { code } = await params
  const upperCode = code.toUpperCase()
  const results = lookupCode(upperCode)

  return (
    <PageWrapper variant="light" width="blog">
      <span className="block text-[10.5px] tracking-[0.12em] text-accent mb-12">
        diplomat plates
      </span>

      <div className="flex flex-col gap-6">
        <span className="text-[36px] font-mono text-light-primary tracking-[0.08em] leading-none">
          {upperCode}
        </span>

        {results.length > 0 ? (
          <div className="flex flex-col gap-2">
            {results.map((r, i) => (
              <p key={i} className="text-[14px] text-light-secondary tracking-[0.01em]">
                {r.country}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-light-muted tracking-[0.01em]">
            code not found
          </p>
        )}

        <Link
          href="/diplomat-plates"
          className="text-[11px] text-light-muted tracking-[0.04em] no-underline transition-colors duration-150 hover:text-light-primary mt-2"
        >
          ← try another
        </Link>
      </div>
    </PageWrapper>
  )
}
