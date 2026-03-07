import { supabase, supabaseAdmin } from './supabase'

export interface Post {
  id: string
  title: string
  slug: string
  content: string | null
  published: boolean
  password: string | null
  created_at: string
  updated_at: string
}

// public — returns only published posts
export async function getPosts(): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

// public — returns a single post by slug (published or not — caller checks)
export async function getPost(slug: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) return null
  return data
}

// admin — returns all posts including drafts
export async function getAllPosts(): Promise<Post[]> {
  const { data, error } = await supabaseAdmin
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function createPost(post: {
  title: string
  slug: string
  content: string
  published: boolean
  password?: string | null
}): Promise<Post> {
  const { data, error } = await supabaseAdmin
    .from('posts')
    .insert({
      title: post.title,
      slug: post.slug,
      content: post.content,
      published: post.published,
      password: post.password ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updatePost(
  id: string,
  updates: Partial<{
    title: string
    slug: string
    content: string
    published: boolean
    password: string | null
  }>
): Promise<Post> {
  const { data, error } = await supabaseAdmin
    .from('posts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('posts').delete().eq('id', id)
  if (error) throw error
}
