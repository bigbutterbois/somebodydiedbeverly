'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function DiplomatLookup() {
  const [code, setCode] = useState('')
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase()
    setCode(val)
    if (val.length === 3) {
      router.push(`/diplomat-plates/${val}`)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (code.length >= 2) {
      router.push(`/diplomat-plates/${code}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-start gap-4">
      <span className="text-[11px] text-light-muted tracking-[0.04em]">enter plate code</span>
      <input
        type="text"
        value={code}
        onChange={handleChange}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="e.g. DAA"
        className="bg-transparent border-b border-border-light text-[36px] font-mono text-light-primary tracking-[0.08em] outline-none w-[120px] pb-1 placeholder:text-light-muted placeholder:text-[24px]"
      />
      <span className="text-[11px] text-light-muted tracking-[0.04em]">
        2–3 characters · press enter
      </span>
    </form>
  )
}
