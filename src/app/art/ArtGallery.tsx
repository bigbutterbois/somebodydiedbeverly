'use client'

import { useState, useCallback, useEffect } from 'react'
import type { Artwork } from '@/data/artworks'
import styles from './ArtGallery.module.css'

interface Props {
  artworks: Artwork[]
}

export default function ArtGallery({ artworks }: Props) {
  const [selected, setSelected] = useState<Artwork | null>(null)

  const close = useCallback(() => setSelected(null), [])

  useEffect(() => {
    if (!selected) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selected, close])

  useEffect(() => {
    if (selected) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [selected])

  return (
    <>
      <div className={styles.grid}>
        {artworks.map((art) => (
          <button
            key={art.id}
            className={styles.item}
            onClick={() => setSelected(art)}
            aria-label={`View ${art.title}`}
          >
            <div
              className={styles.placeholder}
              style={{
                aspectRatio: `${art.width} / ${art.height}`,
                backgroundColor: art.color,
              }}
            />
          </button>
        ))}
      </div>

      {selected && (
        <div className={styles.overlay} onClick={close}>
          <div
            className={styles.lightboxContent}
            onClick={(e) => e.stopPropagation()}
          >
            <p className={styles.lightboxTitle}>{selected.title}</p>
            <div
              className={styles.lightboxImage}
              style={{
                aspectRatio: `${selected.width} / ${selected.height}`,
                backgroundColor: selected.color,
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}
