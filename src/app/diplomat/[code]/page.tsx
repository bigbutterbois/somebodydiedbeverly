import Link from 'next/link'
import PageWrapper from '@/components/ui/PageWrapper'
import { lookupCode } from '@/data/diplomatCodes'
import styles from './page.module.css'

interface Props {
  params: Promise<{ code: string }>
}

export default async function DiplomatResultPage({ params }: Props) {
  const { code } = await params
  const upperCode = code.toUpperCase()
  const results = lookupCode(upperCode)

  return (
    <PageWrapper>
      <div className={styles.container}>
        <span className={styles.code}>{upperCode}</span>

        {results.length > 0 ? (
          <div className={styles.results}>
            {results.map((r, i) => (
              <p key={i} className="text-sm text-ink">
                {r.country}
              </p>
            ))}
          </div>
        ) : (
          <p className={styles.notFound}>code not found</p>
        )}

        <Link
          href="/diplomat"
          className="text-xs text-muted hover:text-ink transition-colors duration-150"
        >
          try another
        </Link>
      </div>
    </PageWrapper>
  )
}
