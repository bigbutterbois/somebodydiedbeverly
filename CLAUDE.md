# somebodydiedbeverly

A personal website built with Next.js 16, React 19, TypeScript, and Tailwind CSS v4. Hosted at `somebodydiedbeverly.com`. The site includes a blog, art section, and a diplomat plate tracker.

## Project Structure

```
src/
  app/           # Next.js App Router pages and layouts
  components/
    ui/          # Shared UI components (NavBar, PageWrapper)
components/      # Root-level component directory
public/          # Static assets
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Font**: Geist (via `geist` package)
- **Linting**: ESLint with `eslint-config-next`

## Dev Commands

```bash
npm run dev      # Start development server at localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Workflow Instructions

### Planning vs. Execution Models

**This is a hard requirement. Do not skip it.**

- **Planning / context-gathering**: ALWAYS switch to the **Opus** model (`claude-opus-4-6`) BEFORE exploring the codebase or writing a plan. This applies any time I ask for a plan, describe a feature, or otherwise seem to be in an exploratory/design phase — even if I don't explicitly invoke plan mode. Do NOT use Sonnet for planning under any circumstances.
- **Execution**: Always use the **Sonnet** model (`claude-sonnet-4-6`) when implementing an approved plan.

### Default Task Flow

When I ask you to do a task, the default workflow is:

1. **Switch to Opus** — before doing anything else, switch to `claude-opus-4-6`.
2. **Plan** — use Opus to explore the codebase, gather context, and produce a concrete plan.
3. **Present** — show me the plan and wait for my approval before writing any code.
4. **Switch to Sonnet** — switch to `claude-sonnet-4-6` for implementation.
5. **Execute** — implement the approved plan.

Don't skip straight to implementation unless I explicitly say so.

### Saving Notes

When I ask you to save notes on your work, always write them to:

```
/Users/michaelpulsipher/dev/vibe-coding-notes/
```

Use descriptive filenames (e.g., `diplomat-tracker-refactor.md`, `blog-layout-notes.md`). Prefer editing an existing notes file over creating a new one if the topic overlaps.
