'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import PageWrapper from '@/components/ui/PageWrapper'
import styles from './page.module.css'

export default function DiplomatPage() {
  const [code, setCode] = useState('')
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase()
    setCode(val)
    if (val.length === 3) {
      router.push(`/diplomat/${val}`)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (code.length >= 2) {
      router.push(`/diplomat/${code}`)
    }
  }

  return (
    <PageWrapper>
      <form onSubmit={handleSubmit} className={styles.container}>
        <span className="text-xs text-muted">enter plate code</span>
        <input
          type="text"
          value={code}
          onChange={handleChange}
          autoFocus
          className={styles.input}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <span className="text-xs text-muted">2-3 characters &middot; press enter</span>
      </form>
    </PageWrapper>
  )
}
