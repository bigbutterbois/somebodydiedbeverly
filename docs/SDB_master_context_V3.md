somebody died beverly
**Master Site Context**
Agent Briefing Document
Paste this entire document at the start of every agent session. Keep it updated as the site grows.
# **the copy-paste block**
This is the block you paste at the start of every agent session. Update it as the site evolves.
SITE CONTEXT — somebody died beverly
URL: somebodydiedbeverly.com
Stack: Next.js, Vercel, GitHub
Font: Geist Sans
Aesthetic: noir, moody, serious — dark charcoal pages for content, warm off-white for listing pages, always intentional
Text: everything lowercase always, no exceptions
Colors:
- Page backgrounds: charcoal #161615 (homepage, blog posts) or warm off-white #faf9f6 (blog listing, gallery, tools)
- Nav bar: always dark/black #111110, regardless of page background
- Text on dark: primary #eceae4, secondary #8a8a82, muted #4a4a45
- Text on light: primary #1a1a18, secondary #7a7a72, muted #b0afa8
- Accent: #00BAAD — used sparingly (hover states, active nav links, section labels, blockquote rules)
- Borders dark: #2c2c2a
- Borders light: #e4e3de
Key libraries (do not substitute these):
- Blog editor: Tiptap (headless rich text editor)
- Blog post storage format: TBD with builder — confirm before implementing (Tiptap JSON vs HTML)
- Gallery lightbox: yet-another-react-lightbox
- Auth: NextAuth.js
- Database: Supabase (Postgres)
- Styling: Tailwind CSS
Pages live:
  / — homepage, centered directory of links
  /blog — writing and essays (some posts password protected)
  /gallery — gallery of work
  /tools — tools I have built
  /tools/diplomat-plates — diplomat license plate tracker tool
  /login — admin login page (standalone, not nested under /admin)
Key requirements:
- Password protection on individual blog posts (not sections)
- Each main section has its own URL path and subpages
- Clean and polished but not overly sparse
- No name displayed on subpages — site name only appears on homepage and in nav header
- Analytics: deferred — do not build unless explicitly requested
- Admin mode: no separate dashboard — features appear inline on public pages
What's built so far: [update this as you go]
Today's task: [describe what you want]
# **site identity**
## **name**
somebody died beverly — always lowercase, never capitalized, never altered.
## **url**
somebodydiedbeverly.com
## **aesthetic**
Noir. Serious. Considered. The site feels like something a person with very specific taste built — not cold, not sterile, not excessive. Dark where it should be dark, light where it breathes. Every element earns its place.
## **typography**
Font: Geist Sans (already installed in the project).
Everything lowercase — navigation, headings, labels, buttons, post titles, metadata. No exceptions. If an agent tries to capitalize something, correct it.
Single weight throughout — understated, nothing dramatic. Size hierarchy is subtle. No bold display headings.
## **color**
See the design system section below for full details. The short version: dark charcoal for immersive pages (homepage, reading), warm off-white for browsing pages (listings, gallery). Nav bar is always dark. Accent #00BAAD used sparingly.
## **tone**
The site has no byline and no author name. It does not explain itself. Content speaks for itself. Serious but not cold.
# **design system**
This was finalized in a design session. Reference the mockup file `SDB_design_mockup_V2.html` for visual reference.
**Note on the mockup**: The mockup contains a `header-on-light` CSS class that is not used in any screen. This is dead code — ignore it. The nav bar is always dark on all pages. The mockup also uses "art" as the nav label and section name — this has been changed to "gallery" everywhere.
## **page backgrounds**
Two surface types — use the right one for each page:
- **dark** (charcoal `#161615`): homepage, individual blog post pages, password prompt
- **light** (warm off-white `#faf9f6`): blog listing, gallery, tools directory
## **nav bar**
Always dark (`#111110`) with a bottom border (`#2c2c2a`). This applies on both dark and light pages — on light pages, the dark nav creates a strong top anchor and the contrast does the work. Height: 52px. Contains site name (left) and nav links (right) on all pages except the homepage.
Nav links: blog, gallery, tools
## **homepage**
No nav header. Fully minimal — just the site name centered on the page, three links below it, and the admin toggle pinned to the bottom. Nothing else. The homepage is intentionally more stripped back than the rest of the site.
- Site name: `font-size: 16px`, primary text color, `letter-spacing: 0.04em`
- Links: 180px wide, bordered list, label + arrow (blog, gallery, tools)
- On hover: both label and arrow turn accent `#00BAAD`
- Admin toggle: small square, bottom-center, 35% opacity
### admin toggle behavior
- **not logged in**: small square at bottom-center, near-invisible at 35% opacity. clicking it navigates to `/login`.
- **logged in, admin mode on**: square shows accent color (#00BAAD) at subtle opacity. clicking it switches to public view mode. admin features visible on all pages.
- **logged in, admin mode off**: square returns to muted appearance. clicking it switches back to admin mode. no admin features visible — you see what visitors see.
- the toggle only appears on the homepage. it does not appear on any subpages.
- toggling does not log you out — it just switches your view perspective.
## **accent color — #00BAAD**
Used sparingly. Appears on:
- Homepage link hover (label + arrow)
- Active nav link
- Section labels (e.g. "blog", "gallery", "tools" eyebrow text)
- Blockquote left border in blog posts
- Password input focus ring
- Post title hover on blog listing
- Admin mode toggle (when active)
Never used as a background. Never used for body text.
## **blog listing**
Light page. Max-width 660px centered. Section label in accent at top. Posts as a bordered list — title left, date right. Lock icon for protected posts. Title turns accent on hover.
## **blog post**
Dark page. Max-width 620px centered. Date as small eyebrow. Title at ~20px. Body text at 14.5px, line-height 1.8, secondary color. Strong text uses primary color. Blockquote has 2px accent left border.
## **gallery**
Light page (warm off-white). CSS columns masonry layout — 2 columns on mobile, 3 columns on desktop, 28px gap. Both columns start at the same level — the natural height variation of images creates the offset organically. Titles visible below each image in the grid. Full details (title, description) appear in the lightbox when an image is clicked. Images dim slightly on hover.
## **password prompt**
Dark page. Centered box, max-width 300px. "protected" eyebrow label. Post title above the input. Input + submit button in a single bordered row. Border turns accent on focus. Error message fades in below.
## **tools directory**
Light page. Same layout as blog listing. Tool name + one-line description. Arrow right. Name turns accent on hover.
# **site structure**
## **homepage — /**
No header. Centered. Site name once, three links below (blog, gallery, tools), admin toggle square at bottom.
## **blog — /blog**
Writing and essays. List of posts with titles and dates. Individual posts live at /blog/[slug].
Key feature: individual posts can be password protected. Visitors without the password see a clean password prompt, not an error.
## **gallery — /gallery**
Gallery of work. CSS columns masonry layout — 2 columns on mobile, 3 columns on desktop. Titles visible below each image. Individual pieces open in a lightbox overlay (yet-another-react-lightbox) — no individual /gallery/[slug] subpages needed. Full details visible in lightbox.
## **tools — /tools**
Tools I've built. Directory of tools, each with its own subpage.
## **tools/diplomat-plates — /tools/diplomat-plates**
A diplomat license plate tracker. Users can look up or browse diplomatic license plates. Built with Claude Code. Scope: moderate complexity, not too intensive.
Status: planned, not yet built.
## **login — /login**
Standalone login page. Matches site aesthetic — dark page, minimal form, lowercase labels. After successful login, redirects to homepage with admin mode activated. Accessible to all users (this is the one page that doesn't return 404 for unauthenticated users).
# **technical setup**
## **stack**
—  Framework: Next.js (App Router)
—  Hosting: Vercel
—  Code storage: GitHub (repo: somebodydiedbeverly)
—  Font: Geist Sans (installed via next/font)
—  Styling: Tailwind CSS
—  Language: TypeScript
—  Database: Supabase (Postgres + file storage)
—  Auth: NextAuth.js (single admin credential via environment variables)
## **key libraries — do not substitute**
—  Blog editor: Tiptap (headless, free, styled to match site aesthetic)
—  Blog post storage format: confirm with builder before implementing — options are Tiptap JSON or HTML
—  Gallery lightbox: yet-another-react-lightbox
—  Analytics: deferred — do not add tracking or analytics tooling unless explicitly asked
## **database tables**
—  `posts` — title, slug, content, published, password, created_at, updated_at
—  `gallery` — title, description, image_url, display_order, created_at, updated_at
—  `countries` — country_name, country_code (seeded from existing codebase data, used as reference for plate_sightings)
—  `plate_sightings` — country_id (references countries), date_spotted, notes, created_at
## **local development**
To run the site locally:
cd ~/somebodydiedbeverly
npm run dev
Then open http://localhost:3000 in the browser.
## **deploying changes**
Every time changes are ready to go live:
git add .
git commit -m "describe what changed"
git push
Vercel automatically publishes within seconds.
## **starting a claude code session**
cd ~/somebodydiedbeverly
claude
Then paste this context document and describe the task.
# **key requirements for agents**
## **always lowercase**
Every single piece of text on this site is lowercase. Navigation, headings, post titles, button labels, metadata, error messages — everything. This is non-negotiable and should never be broken.
## **follow the design system**
The design system section above is the source of truth for all visual decisions. Do not deviate from it without explicit instruction. Reference the mockup file `SDB_design_mockup_V2.html` if you need visual confirmation of how something should look, but note: the mockup uses "art" where we now use "gallery," and contains an unused `header-on-light` class — ignore both.
## **password protection**
Individual blog posts can be password protected. The implementation should be clean — a minimal password input that matches the site aesthetic. No ugly browser-default prompts. Password protection applies to individual posts only, not entire sections.
## **subpages and url structure**
Every main section (/blog, /gallery, /tools) has its own landing page and supports subpages with clean URL slugs. Example: /blog/post-title, /tools/diplomat-plates. Gallery uses lightbox, not subpages.
## **polished but not sparse**
The site should feel complete and considered. White space is intentional, not lazy. Content areas should have proper typographic hierarchy. It should not feel like an unfinished wireframe.
## **mobile first**
Every page must look great on mobile. Test responsiveness on every build.
## **no analytics**
Do not add any analytics, tracking middleware, or third-party scripts unless explicitly requested. This is deferred.
## **admin mode, not admin dashboard**
There is no separate /admin dashboard page. Admin features appear inline on public pages when admin mode is active. The admin mode toggle (small square) only appears on the homepage. On subpages, admin features simply show or hide based on the current mode.
# **⚠ do this first — admin system**
**before building any subpages, the admin system must be set up first. do not skip this.**
The site needs a built-in admin system from the start. This should be the very first thing built before any subpages (/blog, /gallery, /tools).
## **what it does**
—  A single admin account (mine) secured via environment variables
—  Login page at `/login` — standalone, matches site aesthetic
—  Login persists for 90 days so my phone stays logged in
—  Admin mode toggle on homepage (small square, bottom-center)
—  Admin-only features layered inline into each page as it gets built
—  No separate /admin dashboard — features live on public pages
—  Normal visitors never see any admin features
—  Admin routes (e.g., /admin/blog/new) return 404 for unauthenticated users
## **paste this to your builder agent first**
Before we build any subpages, I need an admin system
baked into the site. Use NextAuth.js with a single admin
credential set via environment variables. Once logged in,
persist the session for 90 days so my phone stays
authenticated automatically. Add a /login page that matches
the site aesthetic. On the homepage, add a small square at
bottom-center that navigates to /login when not logged in,
and toggles admin mode on/off when logged in (accent color
when active, muted when inactive). There is no /admin
dashboard — admin features appear inline on public pages.
Admin-specific routes return 404 for visitors. Do this
before anything else.
After the admin system is live, then move on to building subpages.
# **progress tracker**
Update this section after every build session.
**BUILT**
—  Homepage — centered directory with blog, gallery, tools links
—  Basic Next.js project structure with Tailwind and Geist Sans
—  Deployed to Vercel at somebodydiedbeverly.com
—  Design system finalized (design session) — see design system section above
—  Design mockup file: SDB_design_mockup_V2.html

**IN PROGRESS**
—  Domain DNS propagation (Squarespace → Vercel)

**PLANNED**
—  Admin system (login page, admin mode toggle, 90-day session)
—  Rebuild homepage to match finalized design (dark charcoal, no header, centered name + links, admin toggle square)
—  /blog page with post listing
—  /blog/[slug] individual post pages
—  Password protection on blog posts (individual posts only)
—  /gallery page (masonry 2col mobile / 3col desktop, lightbox, titles in grid)
—  /tools directory page
—  /tools/diplomat-plates tracker tool

*keep this document updated after every session.*
