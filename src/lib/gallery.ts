import { supabase, supabaseAdmin } from './supabase'

export interface GalleryItem {
  id: string
  title: string
  description: string | null
  image_url: string
  display_order: number
  created_at: string
  updated_at: string
}

export async function getGalleryItems(): Promise<GalleryItem[]> {
  const { data, error } = await supabase
    .from('gallery')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function createGalleryItem(
  buffer: ArrayBuffer,
  filename: string,
  contentType: string,
  title: string,
  description: string | null
): Promise<GalleryItem> {
  const { error: uploadError } = await supabaseAdmin.storage
    .from('gallery')
    .upload(filename, buffer, { contentType, upsert: false })

  if (uploadError) throw uploadError

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from('gallery').getPublicUrl(filename)

  // get next display_order
  const { data: last } = await supabaseAdmin
    .from('gallery')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)

  const nextOrder = ((last?.[0]?.display_order) ?? -1) + 1

  const { data, error } = await supabaseAdmin
    .from('gallery')
    .insert({ title, description, image_url: publicUrl, display_order: nextOrder })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateGalleryItem(
  id: string,
  updates: { title?: string; description?: string | null }
): Promise<GalleryItem> {
  const { data, error } = await supabaseAdmin
    .from('gallery')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteGalleryItem(id: string, imageUrl: string): Promise<void> {
  try {
    const url = new URL(imageUrl)
    const parts = url.pathname.split('/storage/v1/object/public/gallery/')
    const filename = parts[1]
    if (filename) {
      await supabaseAdmin.storage.from('gallery').remove([filename])
    }
  } catch {
    // continue even if storage delete fails
  }

  const { error } = await supabaseAdmin.from('gallery').delete().eq('id', id)
  if (error) throw error
}

export async function reorderGalleryItems(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      supabaseAdmin.from('gallery').update({ display_order: index }).eq('id', id)
    )
  )
}
