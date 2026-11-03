# CLAUDE.md

## Environment

- This project is a web app that runs on **Railway**, not on this computer.
- Railway deploys the app automatically from the **`main`** branch of the GitHub repository `rebanekatlin-jyrgens/kj-cars-assistant`.
- The database is a **Railway PostgreSQL** database. It is available only through the `DATABASE_URL` environment variable on Railway (`${{Postgres.DATABASE_URL}}` on the app service).
- Do **not** set up a local database or a local server. Never hard-code or commit credentials.

## Deployment

- `railway.json` configures the service: build `npm run build`, start `npm run start:deploy` (applies Prisma migrations, runs the idempotent seed, then starts Next.js on `0.0.0.0:$PORT`), health check `/api/health`.
- The build must never need database access.
- Schema changes need a new committed migration in `prisma/migrations`.

## Workflow

- Before every push, run `npm run build` and make sure it succeeds.
- After each finished task, commit and push to GitHub so that Railway deploys the new version. Never force-push.
- The user interface, validation messages, documentation and code comments are in English.
