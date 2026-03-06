export interface BlogPost {
  slug: string
  title: string
  date: string
}

export const blogPosts: BlogPost[] = [
  { slug: 'hello-world', title: 'hello world', date: '2026-03-01' },
  { slug: 'on-diplomats', title: 'on diplomats', date: '2026-02-14' },
  { slug: 'first-post', title: 'first post', date: '2026-01-10' },
]

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find(p => p.slug === slug)
}
