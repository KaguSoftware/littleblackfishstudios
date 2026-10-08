# Little Black Fish Studios

Portfolio site for Little Black Fish Studios: an animated hero, a 3D sphere gallery of projects, project and category pages, a contact form, a support/donation page, and a private admin dashboard for managing all of it. Bilingual (English and Persian with RTL).

## Stack

- [Next.js 16](https://nextjs.org) (App Router, React 19, TypeScript)
- Tailwind CSS 4, Framer Motion, GSAP (menu animation)
- three.js and `@react-three/fiber` with custom shaders for the sphere/globe
- [Supabase](https://supabase.com) for Postgres, Auth and Storage
- `next-intl` for i18n, Resend for contact-form email
- `@hello-pangea/dnd` for drag-to-reorder in the admin

> Next 16 has breaking changes compared to older versions (for example `middleware` is now `proxy`). Check `node_modules/next/dist/docs/` before changing framework-level code. See [AGENTS.md](AGENTS.md).

## Getting started

Requires Node 22 (see `.nvmrc`).

```bash
npm install
cp .env.example .env.local   # then fill in the values (table below)
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Supabase publishable (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only key used by admin actions. Never expose it to the client. |
| `RESEND_API_KEY` | for contact form | Resend API key |
| `ADMIN_CONTACT_EMAIL` | for contact form | Where contact submissions are emailed |
| `RESEND_FROM` | no | Sender address (defaults to Resend's `onboarding@resend.dev` test sender) |
| `NEXT_PUBLIC_SITE_URL` | no | Canonical URL for the sitemap (defaults to `https://littleblackfishstudios.com`) |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `node --env-file=.env.local scripts/snapshot-db.mjs` | Refresh the offline content snapshot (see below) |

## Project layout

```text
proxy.ts                  Session refresh, admin gate, locale routing
src/
  app/[locale]/           Pages: home, projects, project detail, category, about,
                          contact, support, login, admin
  actions/                Server actions (admin CRUD, auth, contact, reorder)
  components/
    Sphere/               The 3D gallery engine (WebGL, shaders, layout, navigation)
    Hero/ ProjectGrid/ Layout/ Admin/   UI by area
  lib/
    queries/public.ts     Read queries for the public site (with fallback)
    supabase/             Browser, server and proxy Supabase clients
  messages/               en.json and fa.json translations
  data/fallback.json      Content snapshot used when Supabase is unreachable
supabase/migrations/      SQL migrations, applied in filename order
scripts/snapshot-db.mjs   Rebuilds the fallback snapshot
```

## How it works

**Hero slides** are read from `src/data/fallback.json` only (the videos live in `public/videos`), not from the database. Editing slides in the admin does not change the public site until you re-run the snapshot script and redeploy.

**Content and fallback.** All public content (projects, hero slides, categories) lives in Supabase. If Supabase errors or times out, `src/lib/queries/public.ts` serves the same data from `src/data/fallback.json` so the site stays up. Run `scripts/snapshot-db.mjs` after meaningful content changes to refresh the snapshot. It also downloads the images to `public/fallback/`. It can read from the live DB or from CSV exports with `--from-csv`.

**i18n.** Routes are prefixed with `/en` or `/fa`. Persian renders right to left. Strings live in `src/messages/`; content fields in the database come in `_en` / `_fa` pairs.

**Admin.** `/[locale]/admin` is protected in `proxy.ts`: the user must be signed in and have `app_metadata.role === 'admin'` on their Supabase account, otherwise they are redirected to `/[locale]/login`. Admins can edit projects, hero slides and categories, reorder them, upload images (compressed to WebP in the browser first) and read contact submissions.

**Sphere gallery.** The home page globe and the `/projects` page share one layout and label atlas, cached per session in `components/Sphere/cache.ts`, so the dive from one to the other is seamless. Projects with no loadable poster fall back to their gallery photos.

## Database

Migrations are in `supabase/migrations/`. Apply them in order with the Supabase CLI (`supabase db push`) or paste them into the SQL editor. Tables: `projects`, `categories`, `hero_slides`, `contact_submissions`. To make someone an admin, set `{"role": "admin"}` in their user's `app_metadata` (Supabase dashboard, Auth, Users).

## Deployment

Built for Vercel but works on any Node 22 host. `next.config.ts` sets long-lived immutable cache headers on static assets and edge caching (`s-maxage=3600` with stale-while-revalidate) on public pages. Set the environment variables above in your host.
