export interface Artwork {
  id: string
  title: string
  width: number
  height: number
  color: string
}

export const artworks: Artwork[] = [
  { id: 'piece-1', title: 'untitled i', width: 3, height: 4, color: '#2d2d2d' },
  { id: 'piece-2', title: 'morning', width: 16, height: 9, color: '#4a5568' },
  { id: 'piece-3', title: 'study in gray', width: 1, height: 1, color: '#718096' },
  { id: 'piece-4', title: 'drift', width: 4, height: 5, color: '#a0aec0' },
  { id: 'piece-5', title: 'somewhere', width: 3, height: 2, color: '#e2e8f0' },
  { id: 'piece-6', title: 'untitled ii', width: 2, height: 3, color: '#cbd5e0' },
  { id: 'piece-7', title: 'remnant', width: 5, height: 4, color: '#4a5568' },
  { id: 'piece-8', title: 'quiet', width: 9, height: 16, color: '#2d2d2d' },
  { id: 'piece-9', title: 'after rain', width: 3, height: 2, color: '#718096' },
]
