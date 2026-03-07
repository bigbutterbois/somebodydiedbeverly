'use client'

import { useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Captions from 'yet-another-react-lightbox/plugins/captions'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/captions.css'
import type { GalleryItem } from '@/lib/gallery'

interface Props {
  items: GalleryItem[]
}

export default function GalleryGrid({ items }: Props) {
  const [index, setIndex] = useState(-1)

  const slides = items.map((item) => ({
    src: item.image_url,
    title: item.title,
    description: item.description ?? undefined,
  }))

  if (items.length === 0) {
    return (
      <p className="text-[13px] text-light-muted tracking-[0.02em]">no images yet</p>
    )
  }

  return (
    <>
      <div className="columns-2 md:columns-3 gap-7">
        {items.map((item, i) => (
          <div
            key={item.id}
            className="break-inside-avoid mb-7 cursor-pointer group"
            onClick={() => setIndex(i)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.image_url}
              alt={item.title}
              className="w-full h-auto block transition-opacity duration-200 group-hover:opacity-70"
            />
            <p className="text-[11px] text-light-muted tracking-[0.03em] mt-2">
              {item.title}
            </p>
          </div>
        ))}
      </div>

      <Lightbox
        open={index >= 0}
        close={() => setIndex(-1)}
        index={index}
        slides={slides}
        plugins={[Captions]}
      />
    </>
  )
}
