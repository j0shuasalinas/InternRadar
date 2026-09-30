# InternRadar

Find internships you’re eligible for. Track your next step.

Discover early-career internships, get opportunity alerts, and track your applications in one place.

InternRadar is a deployable Next.js SaaS starter for college freshmen and sophomores. The first release uses curated listings; automated collection, scraping, AI, payments, and a separate backend are intentionally out of scope.

## Product

- Public landing page and a credential-free interactive local demo.
- Email/password sign-up and sign-in, email confirmation callback, sign-out, password reset, protected pages, and student onboarding.
- Supabase-backed opportunity discovery with title/company search, class-year, location, work-mode, compensation, and deadline filters.
- Saved roles, application statuses, notes, application and follow-up dates, and an actual-data dashboard.
- Opt-in weekly digests and deadline reminders through Inngest and Resend.
- Admin-only opportunity create/edit/publish/close tools.

Eligibility labels are evidence-based. `Confirmed eligible` requires the source to name the student's class year. `Potentially relevant` is used when the source explicitly says undergraduate students but does not name years. `Eligibility unclear` means the source does not state class-year eligibility. A role that explicitly excludes the student's year is not shown for that year. Preference reasons use only the saved major, skills, location, and work-mode fields.

## Local Development

Requirements: Node.js 20.9 or newer, npm, and (for a local Supabase database) Docker.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

The landing page and `/demo` work without credentials in development. The demo uses fictional opportunities and browser-local state only. It is visibly labeled, is never used as a fallback for a production query failure, and is excluded from production opportunity queries and email jobs. The interactive demo route is disabled in production.

To enable real accounts and data:

1. Create a Supabase project and put its URL and publishable key in `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. Apply the migration with the Supabase CLI: `npx supabase login`, `npx supabase link --project-ref <project-ref>`, then `npx supabase db push`.
3. Set the Supabase Auth site URL and redirect allow-list to include `http://localhost:3000` and `http://localhost:3000/auth/callback`.
4. Create an account, confirm its email, and complete onboarding.

The migration creates the schema and RLS policies. Local fictional SQL examples are isolated in `supabase/seed.local.sql`, and automatic seeding is disabled. To use those records locally, run `npx supabase start`, then execute `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/seed.local.sql`. This is for the local database only. Never run that seed against production.

## Environment Variables

Copy `.env.example` to `.env.local` and configure only the services you use.

- `NEXT_PUBLIC_APP_URL`: public origin used in auth and unsubscribe links (`http://localhost:3000` locally).
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: browser-safe Supabase project settings.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key for background jobs and unsubscribe processing. Never add a `NEXT_PUBLIC_` prefix.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`: Resend credentials; verify the sender domain in Resend before production delivery.
- `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`: Inngest event and production signature keys. The Next.js `serve` adapter verifies signed production calls; the route fails closed if the production signing key is missing.
- `UNSUBSCRIBE_SECRET`: at least 32 random characters used to sign expiring unsubscribe tokens. For example, generate one with `openssl rand -base64 32`.

For local Inngest development, start `npx inngest-cli@latest dev` in another terminal and set `INNGEST_DEV=1` in `.env.local`. Do not set `INNGEST_DEV=1` in production. The alert endpoint is `/api/inngest`.

Preview templates without sending email at:

- `http://localhost:3000/api/email-preview?kind=weekly_digest`
- `http://localhost:3000/api/email-preview?kind=deadline_reminder`

The preview route returns 404 in production and marks all sample content as fictional.

## Admin Access

Users cannot add themselves to `admin_members`: the table has no authenticated insert/update/delete policy or grants. Both the admin page/actions and opportunity RLS policies check server/database membership.

To assign the first admin, first create and confirm that person's Supabase Auth account. Then, as the project owner, run this once in the Supabase SQL Editor, replacing the email:

```sql
insert into public.admin_members (user_id)
select id
from auth.users
where lower(email) = lower('admin@example.com')
on conflict (user_id) do nothing;
```

The insert must return one row. If it returns none, confirm the account exists and the email is correct. Keep admin assignment in the owner-controlled SQL workflow; it is intentionally not exposed in the app.

Admins should use the original public HTTPS source URL, enter only class years explicitly named by the source, and record a note for broad or unclear eligibility. Use the date-only deadline field when the source gives a date; use the precise timestamp field only when the source gives a time and offset. Saving a listing records its verification time. Close a listing when it is no longer open.

## Data And Security

- `profiles` stores onboarding and search preferences; an Auth trigger creates the row. Ownership is always derived from the verified Supabase user, not a submitted `user_id`.
- `opportunities` are public-readable only when published and not demo data. Only admins can write them. Canonical source IDs are unique when present.
- `tracked_applications` has a unique `(user_id, opportunity_id)` constraint. A database trigger appends every initial/status transition to `application_status_history`.
- `notification_settings` is readable/writable only by its owner. `email_deliveries` has no user-facing RLS policy and is accessible to the server role only.
- Unsubscribe tokens are HMAC-signed, expire after 45 days, and carry the user ID inside the signed payload. The browser cannot submit a target user ID. Opening a link does not change settings; a POST confirmation does.
- Email jobs run hourly, select each opted-in user's local 9 a.m. using their validated IANA time zone, and send the weekly digest on local Monday. Jobs page through at most 10,000 opted-in profiles per hourly sweep, process at most 250 opportunities and 1,000 tracked rows per recipient, and batch deadline sends. A digest is skipped if the tracked-row bound prevents a complete exclusion check.
- Delivery rows persist a stable idempotency key before calling Resend. Retries reuse that provider key and skip already-sent rows.
- Database failures are surfaced as errors. Production routes never quietly replace unavailable Supabase data with local fixtures.

Automated policy migrations are checked into `supabase/migrations/`. The current migration was parsed with PostgreSQL's parser, but it still needs to be applied and smoke-tested against a configured Supabase project before production deployment.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Vitest covers eligibility, source URL checks, timezone scheduling, and unsubscribe-token integrity. Playwright covers class-year filtering, pagination, saving, application updates/persistence, mobile overflow, and the non-sending email preview.

## Deploy

1. Apply Supabase migrations to the production project and assign an initial admin.
2. Add the environment variables above to Vercel. Keep service-role, Resend, and Inngest signing keys server-only.
3. Add the deployed callback URL to Supabase Auth's redirect allow-list and set `NEXT_PUBLIC_APP_URL` to the deployed origin.
4. Verify the Resend sending domain and sync the Inngest app to `https://<your-domain>/api/inngest`.
5. Deploy the Next.js app to Vercel and verify sign-up, confirmation, RLS-protected discovery/tracking, an Inngest function registration, and an unsubscribe POST.

## Official References

- [Next.js App Router](https://nextjs.org/docs/app)
- [Supabase SSR Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Inngest Next.js quick start](https://www.inngest.com/docs/getting-started/nextjs-quick-start)
- [Inngest scheduled functions](https://www.inngest.com/docs/guides/scheduled-functions)
- [Resend email idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)