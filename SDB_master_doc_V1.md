somebody died beverly — master document
this is the single source of truth for somebodydiedbeverly.com. it contains the site identity, design system, full feature plan, technical setup, agent rules, and progress tracker. paste it at the start of every claude code session.
file: SDB_master_doc_V1.md — lives in the repo root. version number increments every session.
session workflow
starting a session
cd ~/somebodydiedbeverly claude
paste this document, then describe the task.
during a session
* commit directly to main as you go. no branches.
* use clear commit messages: git add . && git commit -m "describe what changed"
* do not push. i will tell you when to push.
wrapping up a session
when i say "wrap up" or the task is done, do the following:
1. commit any uncommitted work to main with a clear message.
2. summarize what was built and what changed.
3. update this document — edit the progress tracker, resolved decisions, and any other sections that changed. increment the version number in the filename (e.g. SDB_master_doc_V1.md → SDB_master_doc_V2.md).
4. save the updated document to the repo root, replacing the old version: git add . && git commit -m "update master doc to V[n]"
5. do not push — i will push when ready.
6. give me a review prompt — a short script i can paste into a new claude session to cross-check the updated doc against the codebase and flag issues.
site identity
name
somebody died beverly — always lowercase, never capitalized, never altered.
url
somebodydiedbeverly.com
aesthetic
noir. serious. considered. the site feels like something a person with very specific taste built — not cold, not sterile, not excessive. dark where it should be dark, light where it breathes. every element earns its place.
typography
font: geist sans (installed via next/font in the project).
everything lowercase — navigation, headings, labels, buttons, post titles, metadata, error messages. no exceptions. if an agent tries to capitalize something, correct it.
single weight throughout — understated, nothing dramatic. size hierarchy is subtle. no bold display headings.
color
dark charcoal for immersive pages (homepage, reading), warm off-white for browsing pages (listings, gallery). nav bar is always dark. accent #00BAAD used sparingly. full details in the design system section below.
tone
the site has no byline and no author name. it does not explain itself. content speaks for itself. serious but not cold.
design system
finalized in a design session. reference the mockup file SDB_design_mockup_V2.html for visual reference.
note on the mockup: the mockup contains a header-on-light CSS class that is not used in any screen — ignore it. the nav bar is always dark on all pages. the mockup uses "art" as the nav label and section name — this has been changed to "gallery" everywhere.
colors
page backgrounds:   dark (charcoal):    #161615  — homepage, blog posts, password prompt   light (warm white): #faf9f6  — blog listing, gallery, tools directory  nav bar:              #111110  — always dark, all pages  text on dark:   primary:   #eceae4   secondary: #8a8a82   muted:     #4a4a45  text on light:   primary:   #1a1a18   secondary: #7a7a72   muted:     #b0afa8  accent:      #00BAAD  — used sparingly  borders:   dark:      #2c2c2a   light:     #e4e3de
accent color — #00BAAD
used sparingly. appears on: homepage link hover (label + arrow), active nav link, section labels (eyebrow text), blockquote left border in blog posts, password input focus ring, post title hover on blog listing, admin mode toggle (when active).
never used as a background. never used for body text.
nav bar
always dark (#111110) with bottom border (#2c2c2a). height: 52px. contains site name (left) and nav links (right) on all pages except the homepage.
nav links: blog, gallery, tools
on mobile: simple enough that a hamburger menu isn't needed — stack or single row.
page backgrounds
two surface types:
* dark (charcoal #161615): homepage, individual blog post pages, password prompt
* light (warm off-white #faf9f6): blog listing, gallery, tools directory
homepage design
no nav header. fully minimal — site name centered, three links below, admin toggle pinned to bottom.
* site name: font-size: 16px, primary text color, letter-spacing: 0.04em
* links: 180px wide, bordered list, label + arrow (blog, gallery, tools)
* on hover: both label and arrow turn accent #00BAAD
* admin toggle: small square, bottom-center, 35% opacity
blog listing design
light page. max-width 660px centered. section label in accent at top. posts as a bordered list — title left, date right. lock icon for protected posts. title turns accent on hover.
blog post design
dark page. max-width 620px centered. date as small eyebrow. title at ~20px. body text at 14.5px, line-height 1.8, secondary color. strong text uses primary color. blockquote has 2px accent left border.
gallery design
light page (warm off-white). CSS columns masonry layout — 2 columns on mobile, 3 columns on desktop, 28px gap. both columns start at the same level. titles visible below each image in the grid. full details (title, description) in the lightbox. images dim slightly on hover.
password prompt design
dark page. centered box, max-width 300px. "protected" eyebrow label. post title above the input. input + submit button in a single bordered row. border turns accent on focus. error message fades in below.
tools directory design
light page. same layout as blog listing. tool name + one-line description. arrow right. name turns accent on hover.
site structure and features
homepage — /
public
* no nav header — fully minimal
* site name centered on the page
* three links below: blog, gallery, tools
* small square pinned to bottom-center at 35% opacity — clicking navigates to /login
admin mode toggle
* when logged in, the small square becomes the admin mode toggle
* admin mode on: square shows accent color (#00BAAD) at subtle opacity
* admin mode off: square returns to muted appearance
* clicking toggles between modes without logging out
* the toggle only appears on the homepage — not on subpages
* on subpages, admin features appear/disappear based on current mode
blog — /blog
public
* list of all published posts — title (lowercase), date
* sorted newest first
* clicking a post goes to /blog/[slug]
* no categories, no tags, no author name
individual posts — /blog/[slug]
* clean reading experience with good typographic hierarchy
* supported content: paragraphs, headings (h2/h3, lowercase), bold, italic, links, images (with optional captions), tables, blockquotes, code blocks, horizontal rules
* date displayed subtly at top
* no author name, no share buttons, no comments
password-protected posts
* individual posts can be password-protected (not sections)
* visitors see a clean password prompt matching the site aesthetic
* correct password grants session access (cookie-based)
* incorrect password shows subtle error
* protected posts appear in blog listing with a subtle lock icon
admin blog features
* post editor using tiptap with: title, slug (auto-generated, editable), content editor with formatting toolbar (bold, italic, heading, link, image upload, table, blockquote, horizontal rule)
* live preview
* publish/draft toggle (drafts only visible in admin)
* password protection toggle with password field
* delete post with confirmation
* image upload via drag-and-drop or file picker → supabase storage
* editor routes: /admin/blog/new, /admin/blog/edit/[slug]
gallery — /gallery
public
* CSS columns masonry layout — 2 columns mobile, 3 columns desktop, 28px gap
* each piece shows image + title (lowercase) below
* clicking opens lightbox overlay (yet-another-react-lightbox) with full image, title, optional description
* swipe navigation on mobile
* images dim slightly on hover
* no individual /gallery/[slug] subpages
admin gallery features
* upload: drag-and-drop or file picker
* per piece: title (required), description (optional), image file
* reorder by drag-and-drop
* edit title/description after upload
* delete with confirmation
* images in supabase storage, optimized via next.js image component
* admin route: /admin/gallery
tools — /tools
public
* directory page listing all tools
* each tool: name (lowercase), one-line description, arrow right
* clicking goes to subpage
* clean and simple
admin
* tools are built as code, directory doesn't need heavy admin management
diplomat plates — /tools/diplomat-plates
public
* core lookup/browse functionality for diplomatic license plates
* lookup input: styled 3-character display (slot 1 in accent, slots 2-3 in primary), hidden real input, arrow submit button, requires exactly 3 characters
* country checklist — visual list of all diplomatic countries, spotted ones distinguished, progress counter (e.g. "47 of 178 countries spotted")
* no public sightings log (removed)
admin
* form to log a sighting: country dropdown, date (defaults to today, yyyy-mm-dd), optional notes, submit
* first-time country logging checks it off on public list
* multiple sightings per country allowed
* admin table of all sightings with edit/delete
* quick and easy on mobile
* admin route: /admin/tools/diplomat-plates
login — /login
standalone login page. dark page, minimal form, lowercase labels. after login, redirects to homepage with admin mode active. accessible to all users.
admin system
built first, before any content sections.
authentication
* nextauth.js with a single credential (username + password)
* credentials as environment variables on vercel (ADMIN_USERNAME, ADMIN_PASSWORD)
* session persists for 90 days
* no registration, no sign-up — one account
* login page at /login — standalone, not under /admin
admin mode
no separate /admin dashboard. logging in activates admin mode which layers inline features onto public pages.
* admin mode on: edit buttons, upload controls, management features appear inline
* admin mode off (via homepage toggle): you see exactly what visitors see
* all admin routes return 404 for unauthenticated users — pages don't exist for visitors
admin routes
* /admin/blog/new — create a new post
* /admin/blog/edit/[slug] — edit an existing post
* /admin/gallery — manage gallery
* /admin/tools/diplomat-plates — log sightings, manage records
admin ux principles
* admin interface matches site aesthetic — same font, colors, lowercase
* admin features feel like a natural extension of the site
* admin routes return 404 for visitors (not a login redirect)
technical setup
stack
* framework: next.js (app router)
* hosting: vercel
* code storage: github (repo: somebodydiedbeverly)
* font: geist sans (installed via next/font)
* styling: tailwind css
* language: typescript
* database: supabase (postgres + file storage)
* auth: nextauth.js (single admin credential via env vars)
key libraries — do not substitute
* blog editor: tiptap (headless, free, styled to match site)
* blog post storage format: TBD — confirm with builder before implementing (tiptap json vs html)
* gallery lightbox: yet-another-react-lightbox
* analytics: deferred — do not add unless explicitly asked
database
storage: supabase (free tier postgres). provides real CMS experience — write, publish, live. images in supabase storage.
tables
* posts — title, slug, content, published, password, created_at, updated_at
* gallery — title, description, image_url, display_order, created_at, updated_at
* countries — country_name, country_code (seeded from codebase data, reference for plate_sightings)
* plate_sightings — country_id (references countries), date_spotted, notes, created_at
local development
cd ~/somebodydiedbeverly npm run dev
open http://localhost:3000
git workflow
commit directly to main. no branches.
git add . git commit -m "describe what changed"
do not push unless explicitly told to. vercel auto-deploys on push.
agent rules — never break these
always lowercase
every piece of text on the site is lowercase. navigation, headings, post titles, button labels, metadata, error messages. non-negotiable.
follow the design system
the design system section is the source of truth. do not deviate without explicit instruction. reference SDB_design_mockup_V2.html for visual confirmation (note: mockup says "art" where we use "gallery," and has an unused header-on-light class — ignore both).
no library substitutions
use the specified libraries. if you think a different library is better, say so and ask — do not swap silently.
no analytics
do not add analytics, tracking middleware, or third-party scripts unless explicitly requested.
admin routes return 404
admin-specific routes return 404 for unauthenticated users. not a redirect — the pages simply don't exist for visitors.
password protection
individual blog posts only, not sections. clean prompt matching site aesthetic. no browser-default prompts.
mobile first
every page must look great on mobile. test responsiveness on every build.
polished but not sparse
the site should feel complete and considered. white space is intentional, not lazy. proper typographic hierarchy.
code standards
* typescript throughout
* tailwind css for all styling — no inline styles, no CSS modules unless unavoidable
* components should be clean and composable
commit workflow
* commit directly to main — no branches
* do not push unless told to
* update this document at end of every session
footer and navigation notes
* no footer, or extremely minimal (maybe a subtle line). no social links, no copyright, no credits.
* no flashy page transitions. fast and snappy.
* mobile nav simple enough to not need a hamburger menu.
analytics — deferred
this section is out of scope for the current build phase. do not implement any of this unless explicitly requested. preserved for future reference only.
* page views, daily/weekly/monthly counts, top pages, referrers, unique visitors (anonymous session hashing)
* lightweight middleware logging to analytics_events table
* 90-day raw retention, then daily aggregates
* no PII stored
build order
recommended sequence:
1. admin system — nextauth.js, single credential, 90-day session, /login, admin mode toggle
2. database setup — supabase project, tables, env vars in vercel
3. blog — tiptap editor, listing page, post pages, password protection (confirm storage format first)
4. gallery — upload interface, masonry layout, lightbox, titles in grid
5. tools directory — /tools landing page
6. diplomat plates — lookup, admin sighting logger, country checklist
7. polish pass — responsive testing, typography, loading states, error handling, 404 page
analytics is deferred.
resolved decisions
* accent color: #00BAAD — sparingly for hovers, active nav, section labels, blockquote, password focus, admin indicator
* gallery naming: "gallery" everywhere — not "art," "paintings," or "photography"
* gallery url: /gallery (not /art)
* gallery titles in grid: yes
* gallery layout: CSS columns masonry, 2 mobile / 3 desktop, 28px gap
* gallery lightbox: yet-another-react-lightbox
* gallery approach: lightbox overlay, not subpages
* password-protected posts in listings: yes, with lock icon
* password scope: individual posts only
* diplomat plates data source: master list already in codebase, seeded to countries table
* diplomat plates lookup: 3-character codes only (2-letter codes removed from data)
* diplomat plates sightings log: removed from public page (admin-only data entry remains)
* blog editor: tiptap
* blog storage format: TBD — confirm before implementing
* analytics: deferred
* admin session: 90 days
* login page: /login (standalone)
* admin dashboard: none — inline via admin mode toggle
* admin mode toggle: small square, homepage only, bottom-center
* database schema: includes countries reference table, updated_at on gallery
* git workflow: commit to main, no branches, don't push until told
open questions
* blog editor toolbar: how many buttons? 6-8 keeps it clean
* image optimization: max upload size and auto-resize rules TBD
progress tracker
update this after every session.
built
* homepage — centered directory with blog, gallery, tools links
* basic next.js project structure with tailwind and geist sans
* deployed to vercel at somebodydiedbeverly.com
* design system finalized — see design system section
* design mockup file: SDB_design_mockup_V2.html
in progress
* domain DNS propagation (squarespace → vercel)
planned
* admin system (login page, admin mode toggle, 90-day session)
* rebuild homepage to match finalized design
* /blog page with post listing
* /blog/[slug] individual post pages
* password protection on blog posts
* /gallery page (masonry, lightbox, titles in grid)
* /tools directory page
* /tools/diplomat-plates tracker tool
update this document at the end of every session.
