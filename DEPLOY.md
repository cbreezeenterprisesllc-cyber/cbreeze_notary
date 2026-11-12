# Deploying C Breeze Notary and Signing to Vercel

Repo: **cbreeze_notary** · Live domains: **cbreezenotary.shop** and **www.cbreezenotary.shop**

The app is TanStack Start (React + Vite + Tailwind) with a Postgres database (Neon).
Vercel builds it through the Build Output API (`build-vercel.sh`), so no framework
preset has to be picked correctly — `vercel.json` drives the build.

## 1. Import the repo into Vercel

1. Push/confirm the `cbreeze_notary` repo is on GitHub (owner account).
2. Go to **vercel.com/new** → sign in with GitHub.
3. Find **cbreeze_notary** → **Import**.
4. On the configure screen:
   - **Framework Preset:** leave it on **Other** (or "No Framework"). `vercel.json`
     already sets `framework: null`, the install command (`bun install`) and the build
     command (`bun run build:vercel`) — do not override them.
   - **Root Directory:** `./` (the repo root is the app root).
   - **Environment Variables** — add both, for **Production, Preview and Development**:

     | Name | Value |
     | --- | --- |
     | `DATABASE_URL` | the Neon Postgres connection string (the same one the team uses) |
     | `SESSION_SECRET` | the session signing secret (the same one the team uses) |

     Both values are in the team Secrets store. `SESSION_SECRET` must stay the same
     across deploys, otherwise every logged-in business and notary is signed out.
     Optional: `PG_POOL_MAX` — Postgres pool size per serverless instance
     (default 3 on Vercel; raise only if Neon's connection limit allows it).
5. Click **Deploy**. First build takes ~2 minutes.

If the build succeeds, you get a `*.vercel.app` URL — open it and check the home page,
`/signup`, `/login`, `/notary/signup` and `/notary/login` load.

## 2. Add the custom domains

1. Vercel → the **cbreeze_notary** project → **Settings** → **Domains**.
2. Add `cbreezenotary.shop` → Add. Then add `www.cbreezenotary.shop` → Add.
3. Vercel shows the DNS records it wants (they match the GoDaddy records below) and
   keeps them "Invalid Configuration" until DNS is saved at GoDaddy.
4. Recommended: set `cbreezenotary.shop` as the **primary** domain so `www` redirects
   to the bare domain (Vercel does this automatically once both are added).

## 3. GoDaddy DNS records

GoDaddy → **My Products** → **cbreezenotary.shop** → **DNS** (Manage DNS).

1. **Turn off domain forwarding / parking.** If the domain has forwarding set up
   (GoDaddy "Forwarding" section, or a parked page), delete it first — a forwarded or
   parked root domain overrides the A record and the site will never resolve.
2. In the **DNS Records** list:

   | Type | Name | Value | TTL |
   | --- | --- | --- | --- |
   | A | `@` | `76.76.21.21` | 600 seconds (or default) |
   | CNAME | `www` | `cname.vercel-dns.com` | 600 seconds (or default) |

3. **Delete the old parked A record** for `@` pointing at `15.197.148.33` (GoDaddy's
   parking IP). If GoDaddy only lets you edit it, edit that record's value to
   `76.76.21.21` instead of adding a second A record for `@`.
4. Delete any other `@` A records and any `www` CNAME that conflicts with the two rows
   above. Leave MX/TXT records alone (email keeps working).

DNS propagation takes **15 minutes to 48 hours**. Vercel's Domains page flips to
"Valid Configuration" once it sees the records; HTTPS is issued automatically.

## 4. After the domain is live

- Open https://cbreezenotary.shop and https://www.cbreezenotary.shop — both should serve
  the site over HTTPS.
- Log in as a business and post a test signing job, then check a notary dashboard gets
  the offer — this proves the database and session secrets are set correctly on Vercel.
- Deploys after this are automatic: every push to the production branch rebuilds and
  redeploys; pull requests get their own preview URLs.

## How the two build paths coexist

| Path | Command | Output | Used by |
| --- | --- | --- | --- |
| Preview / verification | `bun run publish` | `dist/` + Bun server on port 3000 (`serve.ts`) | the team's live preview surface |
| Vercel | `bun run build:vercel` (called by `vercel.json`) | `dist/` + `.vercel/output` (Build Output API) | Vercel builds |

Both start with the same `bun run build` (Vite). `build-vercel.sh` only *adds*
`.vercel/output` on top; it never touches `publish.sh`, `serve.ts`, `vite.config.ts` or
port 3000, so publishing the preview keeps working exactly as before.

Manual deploy without the Git integration (needs the Vercel CLI and a token):

```bash
bun run build:vercel
bunx vercel deploy --prebuilt
```

## Notes

- Database schema is created/updated automatically on first request (idempotent
  `migrate()`), so no separate migration step is needed on Vercel.
- `DATABASE_URL` and `SESSION_SECRET` are read from `process.env` at request time — set
  them in Vercel's Environment Variables, never in the repo.
- Everything is server-rendered on demand: static assets come from Vercel's CDN, page
  requests hit the `render` serverless function.
