# InternRadar

Find internships you’re eligible for. Track your next step.

Discover early-career internships, get opportunity alerts, and track your applications in one place.

InternRadar is a deployable Next.js SaaS starter for college freshmen and sophomores. The first release uses curated listings; automated collection, scraping, AI, payments, and a separate backend are intentionally out of scope.

## Product

- Public landing page and a credential-free interactive local demo.
- Email/password sign-up and sign-in, email confirmation callback, sign-out, password reset, protected pages, and student onboarding.
- Supabase-backed opportunity discovery with title/company search, class-year, location, work-mode, compensation, and deadline filters.
- Transparent profile-fit scores and reasons, with global fit/deadline sorting before paginated results.
- Saved roles, application statuses and history, notes, application and follow-up dates, timezone-aware overdue actions, and exact dashboard counts.
- Opportunity proof details: curated source notes, explicit eligibility evidence, source links, and precise deadline confidence labels.
- A guided application checklist, private examples drawn from coursework/projects/clubs/volunteering, and personal fit feedback that hides listings only for that user.
- Authenticated iCalendar export with exact/date-only deadlines and personal follow-ups; no calendar event is fabricated for a rolling or unknown deadline.
- A public early-career application toolkit with actionable first-application guidance.
- Listing freshness labels for students, stale-listing review counts for admins, and explicit source re-check confirmation before publishing.
- Opt-in weekly digests and deadline reminders through Inngest and Resend.
- Public, canonical opportunity detail pages and focused browse collections; only current published production listings are indexable, with unclear eligibility excluded from class-year browse claims.
- Authenticated listing reports with an admin review queue.
- Saved searches with separate opt-in weekly email matches; tracked listings are excluded from new-opportunity messages.
- Generated sitemap and robots policy, Open Graph/Twitter defaults, optional Google Search Console verification, and `noindex` metadata for account/workspace pages.
- Admin-only opportunity create/edit/publish/close tools.

Eligibility labels are evidence-based. `Confirmed eligible` requires the source to name the student's class year. `Potentially relevant` is used when the source explicitly says undergraduate students but does not name years. `Eligibility unclear` means the source does not state class-year eligibility. A role that explicitly excludes the student's year is not shown for that year. Preference reasons use only the saved major, skills, location, and work-mode fields.

Fit scores are deterministic and are explanations of profile overlap, not hiring predictions: source-stated eligibility contributes 40 points when confirmed, 24 when the source says undergraduate students without naming class years, or 10 when eligibility is unclear; matching major text contributes 20; each of up to five matching skills contributes 5; preferred location contributes 10; and matching work mode contributes 5. Score reasons and eligibility evidence are shown separately, so a high profile score never changes the source's eligibility wording.

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
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`: optional Search Console verification token. Add the token from Google Search Console in Vercel when verifying the production domain.
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

Admins should use the original public HTTPS source URL, enter only class years explicitly named by the source, and record the source language used for broad or unclear eligibility. Choose deadline certainty that matches the source: exact timestamp, date only, rolling, explicitly not listed, or not yet verified. Exact timestamps require an offset; date-only values never get an inferred time. Published listing saves require an explicit confirmation that the source was re-checked; editing or closing without that confirmation preserves the previous `last_verified_at`. Student-facing freshness is recent through 14 days, due for re-check from 15 to 30 days, and stale after 30 days. Stale listings remain visibly marked until an admin verifies them or closes them.

The application tracker offers a lightweight per-role checklist and private experience notes. These are prompts, not application requirements; only submit materials the employer actually requests. `Export calendar` downloads a private `.ics` file for signed-in users, including source-supported date/timestamp deadlines, recorded application dates, and personal follow-up dates. Rolling or unverified deadlines do not generate guessed dates. Calendar export is a download, not a continuously synchronized subscription.

## Data And Security

- `profiles` stores onboarding and search preferences; an Auth trigger creates the row. Ownership is always derived from the verified Supabase user, not a submitted `user_id`.
- `opportunities` are public-readable only when published and not demo data. Only admins can write them. Canonical source IDs are unique when present.
- `tracked_applications` has a unique `(user_id, opportunity_id)` constraint. A database trigger appends every initial/status transition to `application_status_history`. The private checklist and experience-example notes are stored on the user's tracked application.
- `opportunity_feedback` is private and user-scoped. Dismissal feedback only filters that user's discovery results; it never changes public listings or eligibility claims.
- `opportunities.deadline_type` distinguishes exact timestamps, date-only deadlines, rolling deadlines, explicit no-deadline listings, and unverified deadlines. Only source-supported date/timestamp values are exported as deadline events.
- `notification_settings` is readable/writable only by its owner. `email_deliveries` has no user-facing RLS policy and is accessible to the server role only.
- `saved_searches` is owner-only and uniquely keyed by user plus filter JSON. `opportunity_reports` accepts one report per user/listing; admins alone can read and moderate reports.
- Opportunity slugs are stable identifiers generated from company/title plus an ID suffix. Public SEO queries explicitly exclude demo, unpublished, and expired listings; browse pages with no matching listings are `noindex` and omitted from the sitemap.
- Unsubscribe tokens are HMAC-signed, expire after 45 days, and carry the user ID inside the signed payload. The browser cannot submit a target user ID. Opening a link does not change settings; a POST confirmation does.
- Email jobs run hourly, select each opted-in user's local 9 a.m. using their validated IANA time zone, and send the weekly digest on local Monday. Jobs page through at most 10,000 opted-in profiles per hourly sweep, process at most 250 opportunities and 1,000 tracked rows per recipient, and batch deadline sends. A digest is skipped if the tracked-row bound prevents a complete exclusion check.
- Delivery rows persist a stable idempotency key before calling Resend. Retries reuse that provider key and skip already-sent rows.
- Database failures are surfaced as errors. Production routes never quietly replace unavailable Supabase data with local fixtures.

Automated policy migrations are checked into `supabase/migrations/`. Apply all pending migrations, including `202610030001_public_seo_and_saved_searches.sql` and `202610040001_student_workflow_and_deadline_confidence.sql`, to the configured Supabase project before using saved searches, public slugs, private application checklists, fit feedback, or listing reports. The new SEO routes require the public Supabase URL/key and a valid `NEXT_PUBLIC_APP_URL`; database failures are surfaced rather than replaced with demo content.

Public internship routes are `/internships/<slug>` and curated browse routes are `/internships/browse/<collection>`. Sitemap entries are computed from current real listings at request time. Production deployment must set `NEXT_PUBLIC_APP_URL` to the canonical HTTPS origin. Search Console verification is optional; set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` after claiming the property. The default robots policy excludes APIs, auth, demo, unsubscribe, and private workspace routes.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Vitest covers eligibility, transparent fit scoring and ranking, freshness thresholds, timezone-aware dates, source URL checks, alert scheduling, unsubscribe-token integrity, evidence-gated browse collections, deadline confidence, and iCalendar generation. Playwright covers class-year filtering, pagination, fit scores, source freshness, saving, application updates/history persistence, public toolkit content, mobile overflow, and the non-sending email preview.

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