# memos on Cloudflare Workers

A full rewrite of the memos backend targeting Cloudflare Workers, D1, R2 and
Workers Static Assets. Authentication is delegated entirely to **Cloudflare
Access** — the built-in password/JWT/OAuth auth of upstream memos is gone.

The frontend (`../web`) is unchanged in shape: it talks to this Worker over the
Connect protocol using the same `proto/api/v1` contracts.

## Architecture

| Route                                                                     | Handler                                                    |
| ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `/memos.api.v1.*`                                                         | Connect-RPC services (`src/services/*`)                    |
| `/file/{...}`                                                             | R2 streaming with visibility checks (`src/routes/file.ts`) |
| `/explore/rss.xml`, `/u/:username/rss.xml`, `/sitemap.xml`, `/robots.txt` | `src/routes/rss.ts`                                        |
| `/mcp`                                                                    | Stateless MCP server (`src/routes/mcp.ts`)                 |
| everything else                                                           | static assets (`../web/dist`), SPA fallback                |

Bindings (see `wrangler.jsonc`): `DB` (D1), `BUCKET` (R2), `ASSETS`.

## Local development

```bash
# 1. Install deps and generate proto types
npm install
npm run gen

# 2. Create a local D1 database and apply migrations
npm run db:migrate:local

# 3. Run the Worker (serves API + a placeholder assets dir)
npm run dev            # http://localhost:8787

# 4. In another shell, run the frontend dev server (proxies to :8787)
cd ../web && pnpm dev  # http://localhost:3001

#5. Check local sqlite database
wrangler d1 execute memos --local --command "SELECT * FROM sqlite_master;"
```

Cloudflare Access does not run locally, so set `DEV_USER_EMAIL` in
`wrangler.jsonc` (or a `.dev.vars` file) to impersonate a user during
development. Add that email to `ADMIN_EMAILS` to develop as an admin.
**`DEV_USER_EMAIL` must be empty in production** — it bypasses authentication.

### Tests

```bash
npm test          # vitest with @cloudflare/vitest-pool-workers (real D1/R2)
npm run typecheck
```

## Production deployment

### 1. Create resources

```bash
npx wrangler d1 create memos
npx wrangler r2 bucket create memos-attachments
```

Put the returned D1 `database_id` into `wrangler.jsonc` (replace the
`PLACEHOLDER_SET_AFTER_D1_CREATE`).

### 2. Configure vars and secrets

Edit the `vars` block in `wrangler.jsonc`:

- `ACCESS_TEAM_DOMAIN` — your Zero Trust team name (`<team>.cloudflareaccess.com`)
- `ACCESS_AUD` — the Access application AUD tag (step 5 below)
- `ADMIN_EMAILS` — comma-separated emails that get the ADMIN role
- `INSTANCE_URL` — public URL, e.g. `https://memos.example.com`
- `DEV_USER_EMAIL` — leave empty

Secrets (optional, per feature):

```bash
npx wrangler secret put OPENAI_API_KEY    # AI transcription (OpenAI)
npx wrangler secret put GEMINI_API_KEY    # AI transcription (Gemini)
npx wrangler secret put RESEND_API_KEY    # email notifications
```

### 3. Apply migrations and deploy

```bash
npm run gen
cd ../web && pnpm build && cd ../worker   # builds ../web/dist
npm run db:migrate:remote
npx wrangler deploy
```

Then attach a custom domain to the Worker in the Cloudflare dashboard.

### 4. Cloudflare Access application

The Worker enforces its own authorization on every request (memo visibility,
admin-only settings, ownership checks, etc.) — Access's only job is to
establish *who's asking* by issuing a signed JWT/cookie after login. Because
of that, Access only needs to gate the handful of pages that must force a
login; everything else (public memos, the API used by the SPA, attachments,
static assets) can be left unmanaged by Access and stays reachable, while
still being fully protected by the Worker's own checks.

In **Zero Trust → Access → Applications**, add **one self-hosted**
application scoped to exactly these 5 paths on your custom domain (a self-hosted
app supports up to 5 path entries):

```
/setting
/archived
/attachments
/inbox
/shortcuts
```

- Add an **Allow** policy on it selecting the identities/emails that may sign in.
- Copy the **Application Audience (AUD) Tag** into `ACCESS_AUD` and redeploy.
- Do **not** create a second app or a domain-wide app — leaving the rest of
  the domain unmanaged by Access is intentional (see below).

⚠️ Before relying on this, confirm **Zero Trust → Settings → "Require Access
protection"** is **off** for this zone. That (opt-in, off by default) setting
blocks all traffic to hostnames without a matching Access application instead
of letting it through — if it's on, the paths above are the only ones
reachable at all, breaking the public/explore/API surface.

Once this is deployed, the protected pages behave as follows:

- Visiting `/setting`, `/archived`, `/attachments`, `/inbox` or `/shortcuts`
  directly (or via the "Sign in" nav link, which targets `/setting`) triggers
  the Access login flow and sets a domain-wide `CF_Authorization` cookie.
- Every other request (SPA routes like `/`, `/explore`, `/u/*`, the Connect
  API, `/file/*`, static assets) passes through unmanaged by Access. The
  Worker still reads and verifies that cookie directly
  (`src/auth/access.ts`) when present, so an already-authenticated visitor is
  recognized everywhere on the site — Access's per-path enforcement is not
  what identifies them.
- A visitor who has never authenticated and deep-links straight into one of
  the 5 gated pages (skipping `/`) is the one edge case this doesn't smoothly
  handle: without a cookie yet, that page's client-side auth guard reloads
  the same (Access-protected) URL, which now correctly triggers login. Normal
  navigation from `/` doesn't hit this at all.

### 5. API / MCP clients (replaces personal access tokens)

Built-in personal access tokens are gone. For scripts and MCP clients, add a
**second** self-hosted Access application scoped to `/mcp` (and/or
`/memos.api.v1.*` if you want scripted API access beyond MCP), with a policy
that accepts a Zero Trust **service token**. Service-token traffic only gets
a JWT injected by Access on paths an Access application actively enforces, so
`/mcp` needs its own app even though the rest of the API is left unmanaged.
Map the token's identity to a user by adding its `common_name` to
`ADMIN_EMAILS` (service tokens carry no email claim).

## Removed features

- Password auth, sign-up, SSO/OAuth2 IdP config, personal access tokens,
  linked identities, refresh-token sessions — all handled by Cloudflare Access.
- Server-Sent Events live refresh — the frontend relies on React Query refetch.
- Local-disk / S3 storage backends — all attachments live in R2.
- Server-side image EXIF stripping and thumbnail resizing — EXIF is stripped
  client-side; thumbnails use Cloudflare Image Transformations.
