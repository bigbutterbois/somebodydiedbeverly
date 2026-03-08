# somebody died beverly — site plan
## overview
this is the full feature plan for somebodydiedbeverly.com. everything described here should be built. this document covers what each section does, how the admin system works, what storage to use, and the recommended build order.
the site serves as a personal creative outlet, serious writing platform, gallery, and home for tools — built for a small audience of the owner and close circle, but polished enough that anyone who finds it sees something intentional and complete.
---
## storage recommendation: supabase (postgres)
given what this site needs to do — blog posts written from an admin editor, gallery uploads with metadata, diplomat plate sighting logs with dates and country tracking, and password protection on individual posts — file-based storage (json/markdown in the repo) would become painful fast. every content change would require a git commit and redeploy.
**recommendation: supabase (free tier)**
why supabase specifically:
- free postgres database with generous limits
- built-in file storage for images (gallery uploads, blog images)
- works seamlessly with next.js and vercel
- row-level security if you ever want granular access control
- real-time subscriptions if you ever want live features
- no credit card required for free tier
- you stay in control of your data (it's just postgres)
this gives you a real CMS experience — write a post, hit publish, it's live. upload a piece, add a title, done. log a plate sighting from your phone, the public page updates immediately.
**tables you'll need:**
- `posts` — blog posts (title, slug, content, published, password, created_at, updated_at)
- `gallery` — gallery pieces (title, description, image_url, display_order, created_at, updated_at)
- `countries` — diplomatic countries reference table (country_name, country_code, seeded from existing codebase data)
- `plate_sightings` — logged sightings (country_id references countries table, date_spotted, notes, created_at)
---
## admin system
this is the foundation. it gets built first, before any content sections.
### authentication
- nextauth.js with a single credential (username + password)
- credentials stored as environment variables on vercel (`ADMIN_USERNAME`, `ADMIN_PASSWORD`)
- session persists for 90 days so your phone stays logged in
- no registration, no sign-up — just one account
- login page lives at `/login` — this is a standalone page, not nested under /admin
### admin mode
there is no separate /admin dashboard. instead, logging in activates "admin mode" which layers inline features onto the public pages:
- when logged in with admin mode on, subtle edit buttons, upload controls, and management features appear inline on public pages (e.g., an "edit" link on a blog post, an "upload" button on the gallery page)
- admin mode is toggled via a small square on the homepage (see homepage section below)
- all admin-specific routes (e.g., `/admin/blog/new`, `/admin/blog/edit/[slug]`, `/admin/gallery`, `/admin/tools/diplomat-plates`) return 404 for non-authenticated users — the pages simply don't exist for visitors
### admin routes
- `/admin/blog/new` — create a new post
- `/admin/blog/edit/[slug]` — edit an existing post
- `/admin/gallery` — manage gallery (upload, reorder, edit, delete)
- `/admin/tools/diplomat-plates` — log new sightings, manage records
### admin ux principles
- the admin interface matches the site aesthetic — same font, same colors, same lowercase convention
- admin features are not a separate "app" — they feel like a natural extension of the site
- when logged in with admin mode on, inline controls appear on public pages
- when admin mode is toggled off (via the homepage square), you see exactly what a visitor sees — credentials are remembered, you just switch perspective
- all admin routes return 404 for non-authenticated users (not a login redirect — the pages simply don't exist for visitors)
---
## homepage — /
### public experience
- no nav header — fully minimal
- site name centered on the page
- three links below: blog, gallery, tools
- small square pinned to bottom-center at 35% opacity — clicking it navigates to `/login`
### admin mode toggle
- when logged in, the small square on the homepage becomes the admin mode toggle
- when admin mode is on: square shows accent color (#00BAAD) at subtle opacity
- when admin mode is off: square returns to default muted appearance
- clicking the square toggles between modes without logging out
- the toggle only appears on the homepage — it does not appear on any subpages
- on subpages, admin features simply appear or disappear based on the current mode
---
## blog — /blog
### public experience
- `/blog` shows a list of all published posts
- each post displays: title (lowercase), date
- posts are sorted by date, newest first
- clicking a post goes to `/blog/[slug]`
- no categories, no tags, no author name — just titles and dates
### individual posts — /blog/[slug]
- clean reading experience with good typographic hierarchy
- content supports:
- paragraphs with proper spacing
- headings (h2, h3 — all lowercase)
- bold, italic, links
- images (uploaded via admin, stored in supabase storage, displayed inline with optional captions)
- tables (clean, minimal styling that matches the site aesthetic)
- blockquotes
- code blocks (if ever needed)
- horizontal rules for section breaks
- date displayed at top or bottom (subtle, not prominent)
- no author name, no share buttons, no comments
### password-protected posts
- individual posts can be marked as password-protected in the admin
- password protection applies to individual blog posts only — not entire sections
- visitors who navigate to a protected post see a clean password prompt
- the prompt matches the site aesthetic — minimal input field, lowercase label, no ugly browser defaults
- correct password grants access for the session (cookie-based, doesn't require re-entry on refresh)
- incorrect password shows a subtle error, no aggressive messaging
- protected posts appear in the blog listing but are visually indicated (subtle lock icon or similar)
### admin blog features
- post editor with:
- title field
- slug field (auto-generated from title, editable)
- content editor — plain text with basic formatting toolbar
- formatting options: bold, italic, heading, link, image upload, table insertion, blockquote, horizontal rule
- the editor enforces consistent formatting automatically (e.g., consistent heading sizes, paragraph spacing)
- live preview showing how the post will look on the site
- publish/draft toggle — drafts are only visible in admin
- password protection toggle — with a field to set the password
- delete post (with confirmation)
- image upload within posts — drag and drop or file picker, images upload to supabase storage
---
## gallery — /gallery
### public experience
- `/gallery` shows a clean gallery of all pieces
- CSS columns masonry layout — 2 columns on mobile, 3 columns on desktop, 28px gap
- each piece shows the image and its title (lowercase) below
- clicking a piece opens a larger view in a lightbox overlay
- in the lightbox: full-size image, title, optional description if one exists
- simple navigation between pieces in the lightbox (arrows or swipe on mobile)
- images dim slightly on hover in the grid
- the gallery should feel like a curated portfolio page you'd confidently send to someone
### admin gallery features
- upload interface: drag and drop or file picker
- for each piece: title (required), description (optional), image file
- reorder pieces by drag-and-drop to control display order
- edit title or description after upload
- delete a piece (with confirmation)
- images stored in supabase storage, optimized for web display (next.js image optimization)
---
## tools — /tools
### public experience
- `/tools` is a directory page listing all available tools
- each tool shows: name (lowercase), one-line description
- clicking a tool goes to its subpage
- the directory is clean and simple — it's a starting point, not a showcase
### admin tools features
- the tools directory itself doesn't need heavy admin management since tools are built as code
---
## diplomat plates — /tools/diplomat-plates
### public experience
- the core lookup/browse functionality works as it currently does
- **sightings log** — a section (below the main tool, or as a tab) showing a public feed of spotted plates
- each entry shows: country name, date spotted (formatted as yyyy-mm-dd)
- sorted by date, newest first
- this is a running log — it grows over time
- **country checklist** — a visual list of all diplomatic countries
- countries that have been spotted are checked off / visually distinguished
- shows progress (e.g., "47 of 178 countries spotted" — lowercase, subtle)
- this is public-facing, anyone can see the collection progress
### admin diplomat-plates features
- a simple form to log a new sighting:
- select country from a dropdown (list of all diplomatic countries)
- date field (defaults to today, editable, stored as yyyy-mm-dd)
- optional notes field
- submit button
- when a country is logged for the first time, it gets checked off on the public country list
- a country can be logged multiple times (you might see the same country's plates on different dates)
- admin can view all sightings in a table, edit or delete entries
- the logging form should be quick and easy to use on mobile — this is something you'd use in the moment when you spot a plate
---
## analytics — deferred
> **this section is out of scope for the current build phase. do not implement any of this unless explicitly requested. it is preserved here for future reference only.**
### what to track (built-in, lightweight)
rather than relying on an external analytics tool, a simple built-in system keeps everything self-contained and respects visitor privacy. no cookies for tracking, no third-party scripts.
- **page views** — which pages are visited, how often
- **daily/weekly/monthly view counts** — simple trend over time
- **top pages** — which content gets the most views
- **referrers** — where traffic comes from (if available from headers)
- **unique visitors** — estimated via anonymous session hashing (not tracking individuals, just counting unique sessions)
### what the dashboard shows
- overview: total views today, this week, this month
- chart: views over time (simple line or bar chart)
- top pages list
- referrer breakdown
- no personally identifiable information stored or displayed
### implementation approach
- a lightweight middleware or api route that logs page views to an `analytics_events` table
- the analytics dashboard queries and aggregates this data
- data retention: keep raw events for 90 days, aggregate older data into daily summaries
- this is intentionally simple — if you want deeper analytics later, you can add something like plausible or fathom alongside it
---
## navigation and layout
### site-wide navigation
- minimal persistent navigation on all pages except the homepage
- the site name "somebody died beverly" in the top-left, links back to homepage
- nav links: blog, gallery, tools — top-right or below the site name
- everything lowercase
- on mobile: the nav should be simple enough that a hamburger menu isn't needed — just stack the links or keep them in a single row
### footer
- no footer, or an extremely minimal one (maybe just a subtle line)
- no social links, no copyright notice, no "built with" credits
### page transitions
- keep it simple — no flashy animations
- pages should load fast and feel snappy
---
## mobile considerations
- every page designed mobile-first
- the admin interface must work well on mobile — especially:
- logging diplomat plate sightings (quick form on the go)
- writing short blog posts or notes
- uploading gallery pieces from phone camera roll
- the gallery lightbox should support swipe navigation
- touch targets should be appropriately sized throughout
---
## build order
this is the recommended sequence for implementation:
1. **admin system** — nextauth.js, single credential, 90-day persistent session, `/login` page, admin mode toggle on homepage
2. **database setup** — supabase project, tables (posts, gallery, countries, plate_sightings), environment variables in vercel
3. **blog** — tiptap editor in admin, blog listing page, individual post pages, password protection. confirm post storage format (tiptap json vs html) before building.
4. **gallery** — upload interface in admin, gallery page with CSS columns masonry (2 mobile / 3 desktop), yet-another-react-lightbox, titles visible in grid
5. **tools directory** — /tools landing page
6. **diplomat plates** — public tool functionality, admin sighting logger, country checklist, public feed
7. **polish pass** — responsive testing, typography refinement, loading states, error handling, 404 page
analytics is deferred — not part of this build phase.
---
## resolved decisions
- **accent color**: #00BAAD — used sparingly for hover states, active nav links, section labels, blockquote rules, password input focus, admin mode indicator
- **gallery section naming**: "gallery" everywhere — nav links, labels, URLs, database table, docs. not "art," "paintings," or "photography."
- **gallery URL**: `/gallery` (not `/art`)
- **gallery titles in grid**: yes — titles visible below each image in the main gallery grid, not lightbox-only
- **gallery layout**: CSS columns masonry, 2 columns on mobile, 3 columns on desktop, 28px gap
- **gallery lightbox library**: yet-another-react-lightbox — lightweight, supports swipe on mobile, easy to style
- **password-protected posts in listings**: yes — protected posts show their title and date in the blog list, with a subtle visual indicator (lock icon or similar). visitors see the post exists but hit a password prompt when they click in.
- **password protection scope**: individual blog posts only — not entire sections
- **gallery approach**: lightbox overlay, not subpages. clicking a piece opens a larger view in an overlay. no individual /gallery/[slug] urls needed.
- **diplomat plates data source**: the master list of diplomatic countries and codes is already in the codebase. the database will be seeded from this existing data into a `countries` table.
- **blog editor library**: tiptap — headless rich text editor, free and open source. lives inside the admin at `/admin/blog/new` and `/admin/blog/edit/[slug]`. styled to match the site aesthetic. supports all required formatting (headings, bold, italic, links, images, tables, blockquotes, horizontal rules, code blocks).
- **blog post storage format**: to be decided with the builder — options are tiptap's native json format (more flexible, requires tiptap to render) or html (simpler to render anywhere). builder should propose and confirm before implementing.
- **analytics**: deferred. do not build unless explicitly requested.
- **admin session length**: 90 days
- **login page**: `/login` — standalone page, not nested under /admin
- **admin dashboard**: none — admin features appear inline on public pages via admin mode toggle
- **admin mode toggle**: small square on homepage only, bottom-center, 35% opacity when not logged in (navigates to /login), accent-colored when admin mode is active, muted when admin mode is off. toggles between admin view and public view without logging out.
- **database schema**: includes `countries` reference table for diplomat plates foreign key relationships, and `updated_at` on gallery table
## open questions to resolve during build
- **blog editor specifics**: how much formatting toolbar is enough? a simple toolbar with 6-8 buttons keeps it clean
- **image optimization**: next.js image component handles a lot, but max upload size and automatic resizing rules should be defined
