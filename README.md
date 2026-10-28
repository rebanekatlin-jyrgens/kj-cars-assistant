# KJ Cars Assistant

A responsive web application that helps car owners submit a **vehicle sale enquiry** to the used-car business **KJ Cars**. A guided chat asks one question at a time, collects the vehicle and seller details, accepts vehicle photos and produces an editable summary that the customer confirms and submits.

> **Educational prototype.** Built for an assignment. Use fictional data only. It is **not ready for real customer data** without a production review (security, privacy/GDPR, data retention, monitoring, backups and load testing).

## Features

- **Sell My Car workflow**: a deterministic, state-based conversation covering make, model, year of first registration, registration number, VIN (optional), mileage (km), fuel type, transmission, service history, known faults, asking price (EUR), location, photos (optional), seller name and contact details (at least one valid email or phone).
- **Server-side validation** of structured values (plausible year, non-negative mileage and price, VIN format, email/phone format) with clear explanations. Invalid answers never lose progress.
- **Progress persisted in PostgreSQL.** Reloading the page restores the conversation and the next unanswered question.
- **Editable summary** with photo thumbnails, two confirmations (accuracy and contact consent) and an **idempotent "Submit Enquiry"**. Each enquiry gets a unique reference, a timestamp and the status `Submitted`.
- **Chat app features**: chat history sidebar, New Chat, open, delete (with confirmation), Clear Chat (with an explanation of what is removed), timestamps, a "Typing..." indicator, an auto-expanding input, Send and Attach File.
- **Top bar**: a simulated "LLM Model" selector (GPT-4, Claude, Local Llama), a "System Prompt" selector, a "Manage Prompts" modal, and Temperature and Top-P sliders (0.0-1.0, step 0.1). All are saved per chat.
- **Photo uploads**: JPEG, PNG and WebP, up to 5 MB each and 8 per enquiry, with previews, progress and removal. File type and size are checked again on the server.
- **Private by default**: data is scoped to the visitor through an HttpOnly cookie. **Continue on another device** creates a one-time, expiring private link (with a QR code).

The assistant never invents vehicle specifications, history or condition. It never claims to have checked registries, accident records or market prices, and it never makes an automatic purchase offer. Submitting an enquiry does not send any email or notification; email delivery is outside the scope of this version.

## Demo mode and its limitations

The application runs in **demo mode** and calls **no real AI model**:

- The **Sell My Car** workflow is a deterministic state machine (`src/lib/seller/flow.ts`). Model, prompt, temperature and top-p settings do **not** affect it.
- The other personas (**Coder**, **Writer**, **Math** and custom prompts) return **clearly labelled simulated responses** from templates (`src/lib/server/simulate.ts`). The Math persona evaluates plain arithmetic exactly.
- `sendMessage(text, model, settings)` (`src/lib/client/api.ts`) waits about **1.5 seconds** to simulate model latency.
- The model choices (GPT-4, Claude, Local Llama) are labels only.

## Technology stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) with TypeScript |
| UI | Tailwind CSS v4, shadcn/ui-style components (Radix UI), Lucide React icons, Sonner toasts |
| Database | Render PostgreSQL (`kj-cars-db`) with Prisma ORM 6 |
| Hosting | Render Web Service, auto-deployed from GitHub `main` |
| Source | https://github.com/rebanekatlin-jyrgens/kj-cars-assistant |

## Project structure

```
prisma/
  schema.prisma          Data model (Visitor, AccessToken, ResumeLink, SystemPrompt,
                         ChatSession, Message, VehicleEnquiry, Attachment)
  migrations/            Committed SQL migrations (applied with prisma migrate deploy)
  seed.mjs               Idempotent seed for the default system prompts
src/app/                 Pages (/ and /resume) and API route handlers (/api/...)
src/components/          UI (app/ = application components, ui/ = shadcn-style primitives)
src/lib/seller/flow.ts   Seller workflow state machine and shared validators
src/lib/server/          Database client, visitor access, error handling, simulation
src/lib/client/api.ts    Browser API client, including sendMessage()
scripts/check-flow.ts    Offline checks for the workflow and validators
render.yaml              Render Blueprint (web service only)
```

## Data model

- **Visitor**: an anonymous owner of all data. Deleting a visitor cascades to everything they own.
- **AccessToken**: one per device or browser. The cookie holds a random 256-bit token, and the database stores only its SHA-256 hash.
- **ResumeLink**: a one-time "continue on another device" token (hash only), with `expiresAt` and `usedAt`.
- **SystemPrompt**: shared defaults (`ownerId = null`, seeded by slug) and visitor-owned prompts. Editing a default creates a visitor copy (`basedOnId`), and the default is never changed.
- **ChatSession**: title, model, temperature, top-p and the selected `systemPromptId`. Deleting a prompt sets this to `null` (or to the original default, when the deleted prompt was a copy).
- **Message**: user and assistant messages. Deleted with their chat (cascade).
- **VehicleEnquiry**: the collected answers, the workflow `step`, contact details, `status` (`Draft` / `Submitted`), the unique `reference`, `consentAt` and `submittedAt`.
  - Deleting a chat deletes its *draft* enquiry.
  - A *submitted* enquiry is kept, and its `chatId` becomes `null` (SetNull).
- **Attachment**: photo bytes, MIME type, size and filename. Deleted with its enquiry (cascade).

## API

All endpoints are scoped to the visitor's cookie. A resource that belongs to another visitor returns `404`.

| Method and path | Purpose |
| --- | --- |
| `GET /api/chats`, `POST /api/chats` | List chats; create a chat (`{ mode: "seller" \| "general", settings }`) |
| `GET /api/chats/[id]`, `DELETE /api/chats/[id]` | Load a chat with messages and enquiry; delete a chat |
| `POST /api/chats/[id]/messages` | Send a message (`{ text, model, settings }`) and get the assistant reply |
| `PUT /api/chats/[id]/settings` | Save model, system prompt, temperature and top-p |
| `POST /api/chats/[id]/clear` | Clear messages (and reset a draft enquiry) |
| `POST /api/chats/[id]/enquiry` | Start the seller workflow in an empty chat |
| `GET /api/enquiries/[id]`, `PATCH /api/enquiries/[id]` | Read an enquiry; edit one field (`{ field, value }`) |
| `POST /api/enquiries/[id]/submit` | Idempotent submission (`{ confirmAccurate, consentContact }`) |
| `POST /api/enquiries/[id]/attachments` | Upload one photo (multipart `file`) |
| `GET /api/attachments/[id]`, `DELETE /api/attachments/[id]` | Serve a photo (owner only); remove a photo |
| `GET/POST/PUT/DELETE /api/prompts` | List, create, edit (`{ id, name, content }`) and delete (`?id=`) prompts |
| `POST /api/resume`, `POST /api/resume/redeem` | Create and redeem a cross-device resume token |
| `GET /api/health` | Health check (does not touch the database) |

## Deploying on Render

The app uses the **existing** Render PostgreSQL database **`kj-cars-db`**. Do **not** create another database.

### Required environment variables

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | The **Internal Database URL** of `kj-cars-db` (from the database's *Connections* section in the Render dashboard). Set it only in Render; never paste it into chats or commit it. |
| `NODE_VERSION` | `22` (set by `render.yaml`; `.nvmrc` also says 22) |
| `NEXT_TELEMETRY_DISABLED` | `1` (optional) |

`PORT` is provided by Render automatically. `next start -H 0.0.0.0` listens on all interfaces and reads `PORT` itself.

### Option A: Blueprint (`render.yaml`)

1. In Render choose **New > Blueprint** and connect `rebanekatlin-jyrgens/kj-cars-assistant` (branch `main`).
2. The Blueprint defines **only the web service**, with no database. When asked for `DATABASE_URL`, paste the Internal Database URL of `kj-cars-db` into the Render form.
3. Make sure the web service is in the **same region** as `kj-cars-db` (uncomment and set `region` in `render.yaml` if needed). Otherwise use the External Database URL.

### Option B: Web Service created manually

1. **New > Web Service**, then connect the GitHub repository and select branch `main`. Auto-Deploy should be **On commit**.
2. Settings:
   - **Runtime:** Node
   - **Region:** same as `kj-cars-db`
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm run start:render`
   - **Health Check Path:** `/api/health`
3. **Environment:** add `DATABASE_URL` (Internal Database URL of `kj-cars-db`) and `NODE_VERSION=22`.

### Build, migrations and seed

- **Build** (`npm run build` = `prisma generate && next build`) **does not need database access**. All API routes are dynamic and only connect at request time.
- **Start** (`npm run start:render`) runs:
  1. `prisma migrate deploy`: applies the committed migrations in `prisma/migrations` (a no-op when they are already applied).
  2. `node prisma/seed.mjs`: the **idempotent** seed. It upserts the default prompts *KJ Cars Seller Assistant*, *Coder*, *Writer* and *Math* by slug, never creates duplicates and never overwrites them.
  3. `next start -H 0.0.0.0`.
- On a paid Render plan you can instead set **Pre-Deploy Command** to `npm run db:migrate && npm run db:seed` and **Start Command** to `npm start`.
- To re-run manually, use the web service's **Shell** tab: `npm run db:migrate` and `npm run db:seed`.
- To change the schema later, edit `prisma/schema.prisma`, create a migration with `npx prisma migrate dev --name <change>` against a development database, then commit the new folder in `prisma/migrations`.

### Public domain

Render gives the service a public URL such as `https://kj-cars-assistant.onrender.com` (see the service page). To use your own domain, open **Settings > Custom Domains**, add the domain, create the DNS record Render shows (CNAME, or A/ALIAS for an apex domain) and wait for the TLS certificate. No app configuration changes are needed, because the resume link is built from the browser's current origin.

> On the free plan the service sleeps after a period of inactivity, so the first request can take up to about a minute.

## Photo storage

For this small prototype, photo **bytes are stored in PostgreSQL** (`Attachment.data`), so they survive redeploys. Render's container filesystem is ephemeral and is never used. Photos are served only through `GET /api/attachments/[id]`, which checks that the requesting visitor owns the photo. The real file type is detected from the file's first bytes, not trusted from the browser.

**For production, object storage (for example S3 or Cloudflare R2) with short-lived signed URLs is preferable.** Storing images in the database increases database size, backup time and memory use.

## Access control and cross-device resume links

- On a first visit the server creates an anonymous **Visitor** and sets an **HttpOnly, SameSite=Lax** cookie (`Secure` in production). The cookie holds a high-entropy token, and only its SHA-256 hash is stored.
- Every query filters by the visitor, so chats, enquiries, contact details, custom prompts and photos are never listed publicly or shown to other visitors.
- **Continue on another device** (sidebar) creates a private link `https://<your-app>/resume#token=...&chat=...`:
  - The token is in the **URL fragment**, so browsers never send it to the server, logs or link-preview bots.
  - It is **one-time** (atomically marked as used) and **expires after 15 minutes**. Only its hash is stored.
  - The `/resume` page **removes the token from the address bar** straight away, exchanges it over POST for a new HttpOnly cookie on the second device, then opens the same conversation.
  - Treat the link as a secret. On the second device it replaces any chats that browser had before.

## Error handling

- When the database is unavailable, the API returns `503` with a friendly message. Saved progress is untouched, and the UI offers **Try again**.
- **Empty or too-long messages** (over 2,000 characters) are rejected with a clear message. The typed text is kept in the input.
- **Invalid field values** get an explanation, and the same question is asked again.
- **Upload problems** (wrong type, too large, over 8 photos, network failure) show a specific message on the photo and as a toast.
- **Repeated submissions** return the existing reference instead of creating a duplicate.
- A **missing or unauthorised resource** returns `404` with "We couldn't find that ...".
- Errors are logged on the server without secrets. The browser never receives stack traces, credentials or private data.

## Testing the application

### Offline checks (no database)

```bash
npm ci
npm run build        # prisma generate + next build, no database needed
npm run lint         # TypeScript type check
npm run test:flow    # seller workflow and validator checks
```

### Checklist on the deployed Render app

Use fictional data, for example *Skoda Octavia, 2016, 123 ABC, 145000 km, Diesel, Manual, Tartu, Jane Example, jane@example.com*.

1. **Chats**: create, reopen, clear (read the confirmation) and delete (with confirmation) a chat.
2. **Seller flow**: select **Sell My Car**, then try invalid values (year `2099`, mileage `-5`, VIN `ABC`, email `jane@example`). Each should be explained without losing progress. Skip the VIN and answer "I don't know" to service history.
3. **Reload** in the middle of the flow: the conversation and the next question come back.
4. **Photos**: upload JPEG/PNG/WebP images, try a file over 5 MB and a non-image, and try more than 8. Remove a photo, then open a thumbnail.
5. **Summary**: edit fields (including invalid edits), tick both confirmations, then double-click **Submit Enquiry**. There should be exactly one reference. Reopen the chat to see the submitted enquiry.
6. **Prompts and settings**: add, edit and delete prompts (editing a default creates "Your copy"). Change model, prompt and sliders, then reload; they should be kept per chat.
7. **Second device**: open **Continue on another device**, scan the QR code with a phone and continue the same conversation. Opening the link a second time should fail.
8. **Privacy**: in a private window (a new visitor), opening `/?chat=<id>` of another visitor shows "That conversation no longer exists or isn't available in this browser." Photo URLs return 404.
9. **Responsive layout**: check desktop (sidebar about 260px) and mobile (hamburger menu, and the input stays visible while the keyboard is open).
10. **Persistence**: trigger a manual redeploy in Render and check that chats, prompts, enquiries and photos are still there.

## Local development (optional)

Create `.env` from `.env.example` with a PostgreSQL URL for a development database, then run `npm run db:migrate && npm run db:seed && npm run dev`. `.env` files are git-ignored. Never commit real credentials.
