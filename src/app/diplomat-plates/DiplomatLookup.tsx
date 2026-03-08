'use client'

import { useState, useRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function DiplomatLookup() {
  const [code, setCode] = useState('')
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-start gap-4">
      <span className="text-[11px] text-light-muted tracking-[0.04em]">enter plate code</span>

      {/* character slot display + hidden input wrapper */}
      <div className="relative flex items-end gap-0">
        {/* hidden real input — captures keystrokes, caret visible */}
        <input
          ref={inputRef}
          type="text"
          value={code}
          onChange={handleChange}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={3}
          className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10"
          aria-label="enter 3-character plate code"
        />

        {/* visual character slots */}
        <div
          className="flex gap-2 cursor-text"
          onClick={() => inputRef.current?.focus()}
        >
          {chars.map((ch, i) => (
            <div
              key={i}
              className={`w-[52px] h-[64px] flex items-end justify-center pb-2 border-b-2 transition-colors duration-150 ${
                ch
                  ? 'border-light-primary'
                  : i === code.length
                  ? 'border-accent'
                  : 'border-border-light'
              }`}
            >
              <span
                className={`text-[36px] font-mono leading-none tracking-[0.04em] ${
                  ch
                    ? i === 0
                      ? 'text-accent'
                      : 'text-light-primary'
                    : 'text-light-muted opacity-30'
                }`}
              >
                {ch || '–'}
              </span>
            </div>
          ))}

          {/* submit arrow */}
          <button
            type="submit"
            disabled={code.length < 3}
            className={`ml-3 self-end pb-2 text-[24px] leading-none font-mono transition-colors duration-150 ${
              code.length === 3
                ? 'text-accent cursor-pointer'
                : 'text-light-muted opacity-30 cursor-default'
            }`}
            aria-label="look up code"
          >
            →
          </button>
        </div>
      </div>

      <span className="text-[11px] text-light-muted tracking-[0.04em]">
        3 characters · press enter
      </span>
    </form>
  )
}
