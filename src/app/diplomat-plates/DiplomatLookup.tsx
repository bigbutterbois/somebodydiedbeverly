'use client'

import { useState, useRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function DiplomatLookup() {
  const [code, setCode] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase()
    setCode(val)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (code.length === 3) {
      router.push(`/diplomat-plates/${code}`)
    }
  }

  const chars = [code[0] ?? '', code[1] ?? '', code[2] ?? '']
  const canSubmit = code.length === 3

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-start gap-4">
      <span className="text-[11px] text-light-muted tracking-[0.04em]">enter plate code</span>

      <div className="flex items-end gap-3">
        {/* Character display with hidden input overlay */}
        <div
          className="relative cursor-text"
          onClick={() => inputRef.current?.focus()}
        >
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={handleChange}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={3}
            className="absolute inset-0 opacity-0 w-full cursor-text"
          />
          <div className="flex font-mono text-[36px] tracking-[0.08em] leading-none border-b border-border-light pb-1 w-[120px]">
            <span className={chars[0] ? 'text-accent' : 'text-light-muted'}>
              {chars[0] || '_'}
            </span>
            <span className={chars[1] ? 'text-light-primary' : 'text-light-muted'}>
              {chars[1] || '_'}
            </span>
            <span className={chars[2] ? 'text-light-primary' : 'text-light-muted'}>
              {chars[2] || '_'}
            </span>
          </div>
        </div>

        {/* Submit arrow */}
        <button
          type="submit"
          disabled={!canSubmit}
          className={`text-[24px] leading-none pb-1 transition-colors duration-150 ${
            canSubmit ? 'text-accent hover:text-light-primary' : 'text-light-muted cursor-default'
          }`}
        >
          →
        </button>
      </div>

      <span className="text-[11px] text-light-muted tracking-[0.04em]">
        3 characters · press enter
      </span>
    </form>
  )
}
