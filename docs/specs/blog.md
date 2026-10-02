# Blog

## Decisions

- **Editor**: rich text, Google-Docs-like (headings, bold/italic, links, lists, quotes, inline images). Not Markdown. v1 used Tiptap (`legacy-v1:src/components/editor/TiptapEditor.tsx`); reusing Tiptap is fine.
- **Organization**: each post has one category. No tags.
- **Publishing**: a post is either a draft or published. No scheduled publishing.
- **Gallery embeds**: none. Posts don't pull in gallery pieces.

## Public side (`src/app/(site)/blog`)

- `/blog`: published posts, newest first, filterable by category.
- `/blog/[slug]`: a single post.
- `/blog/category/[category]` (or a query param): posts in one category.

## Admin side (`src/app/admin/blog`)

- List of all posts with draft/published status.
- New and edit pages with the rich-text editor, title, slug (auto from title, editable), category picker (with "add new category"), and Save draft / Publish / Unpublish / Delete.
- Images dropped into a post upload to Supabase Storage.

## Data

- `categories`: id, name, slug.
- `posts`: id, title, slug (unique), content (editor JSON or HTML), category_id, status (`draft` | `published`), published_at, created_at, updated_at.
- RLS: public can read published posts and categories; only the owner can write.

## Out of scope

Comments, tags, scheduling, per-post passwords (the whole public side is already behind the family password).
