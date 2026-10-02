# Module specs

Decisions Mike made in the "Module planning" project thread on 2026-10-02. Build threads implement from these; anything a spec leaves open, pick the simplest option and note it in the PR.

Site layout (from the skeleton in PR #5):

- **Public side** sits behind the shared family password (`/enter`, remembered per device). Pages live in `src/app/(site)/<module>`.
- **Private side** is owner-only (Supabase login at `/login`). Tools live in `src/app/admin/<module>`.
- Each module owns its own Supabase migration in `supabase/migrations/`.

| Module | Side | Spec |
| --- | --- | --- |
| Blog | public read, admin write | [blog.md](blog.md) |
| Gallery | public read, admin write | [gallery.md](gallery.md) |
| Diplomat plate tracker | admin write, public read-only progress | [plate-tracker.md](plate-tracker.md) |
| Election forecast (Senate 2026) | public | [election-forecast.md](election-forecast.md) |
