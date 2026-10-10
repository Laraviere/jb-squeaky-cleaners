# JB Squeaky Cleaners website

Next.js 16 App Router, TypeScript, React, and Tailwind CSS. Public pages: Home, Residential, Commercial, Careers, About, Gallery, and Request a Quote.

## Local development

```sh
npm install
npm run dev
```

Open http://localhost:3000. Validate with `npm run lint` and the default `npm run build` (Turbopack).

## Quote request storage

The existing Supabase CLI configuration and project link alone do not configure the website. The quote form uses a Next.js Server Action and Supabase's REST Data API; no secret key is shipped to the browser.

1. Copy `.env.example` to `.env.local`.
2. Set `SUPABASE_URL` to the intended project's URL and `SUPABASE_SECRET_KEY` to its server-only `sb_secret_...` key. A legacy `SUPABASE_SERVICE_ROLE_KEY` is also supported. Never prefix either secret with `NEXT_PUBLIC_`.
3. Review and apply `supabase/migrations/20261003000000_create_quote_requests.sql` to that project using the Supabase SQL editor or your normal migration workflow. The migration creates `public.quote_requests`, enables RLS, denies public/anonymous access, and grants the server role INSERT plus SELECT of the ID needed to confirm the insert. It does not change existing tables.
4. Restart the local server. The form reads configuration at request time. If credentials are missing, the submit button is disabled and the visitor is directed to call or email.
5. Test with a real request and confirm the row in Supabase. A successful UI state requires an HTTP 201 response with a saved row ID. Database, network, and configuration failures do not produce a success message.

All contact and cleaning fields are validated again on the server. A hidden honeypot rejects basic automated submissions. Requests are saved to Supabase only; notification email and booking are not implemented. Authorized staff can review requests in the local `/admin` portal after its migration and Auth configuration are installed. Before enabling a high-traffic public form, choose a persistent rate limit or CAPTCHA appropriate to your hosting setup.

The quote migration has already been applied locally and to the hosted project. This admin development phase does not change hosted data or configuration. Credentials and a compatible table are required for storage; without them, call/email remain available.

## Branding and photography

Approved assets are served from `public/branding`. The native `app/favicon.ico`, Apple touch icon, and manifest icon references are preserved. The 10 supplied JPEGs under `public/images` are used without changing the original files. Only the kitchen is presented as a matched before/after pair. Bedroom images are explicitly labeled as before-only project views.

Keep changes local until reviewed. No deployment configuration is required for local review.

## Careers and employment applications

`/careers` uses the four-page source in `docs/JB SQUEAKY CLEANERS LLC APPLICATION.pdf`. Its eight-step form retains the applicable questions and applicant certification. License numbers, criminal-history details, screening authorizations, and company-use-only fields are intentionally excluded. Education and prior employment may be omitted when not applicable; two references are requested. Desired pay is optional, but rate and pay period must be supplied together.

The original document is not served publicly. Unfinished applications are saved on the device in localStorage after a 400ms debounce, with pending edits flushed on page exit and client navigation. Only allowlisted applicant fields, step, version, timestamps and an unconfirmed-submission flag are stored; no signed tokens, credentials, cookies or URL answers. Returning applicants choose Continue Application or Start New Application; Discard Draft clears device data and resets the form. Drafts expire seven days from the first save, not seven days from each visit or edit. Storage failures leave the form usable and display a warning. Browser storage is device-local and is not encrypted; applicants on shared devices should discard drafts. The review screen allows editing; the typed applicant name records acknowledgment, without claiming to replace all hiring signatures or screening paperwork.

### Backend activation (production remains disabled)

1. `supabase/migrations/20261009000000_create_employment_applications.sql` was previously applied locally and to the hosted project. Keep production applications disabled until separate activation approval. Do not change the working quote migration or quote tables.
2. Reuse the existing server-only `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`). Set a separate `EMPLOYMENT_APPLICATION_SECRET` to a cryptographically random value of at least 32 characters. Never expose this secret or the Supabase privileged key with a `NEXT_PUBLIC_` name.
3. After the migration and security review, set `EMPLOYMENT_APPLICATIONS_ENABLED=true` and restart/rebuild as appropriate. Until then the page shows an unavailable state and renders no application inputs. Even when enabled, a server-only readiness RPC must succeed before the form appears; submission rechecks readiness.
4. Validate the complete flow against a non-production project before public activation. Do not submit test applications to production.

### Storage and access

The Server Action repeats all validation, strips unknown fields, rejects honeypots, and verifies a server-signed submission token (valid after 2 seconds and for 24 hours). The server then calls `submit_employment_application` using a privileged key. Success requires a confirmed saved UUID. Failure retains entries and never claims a save. Application IDs and submission timestamps are generated by PostgreSQL; status defaults to `new` and is not supplied by the applicant.

`employment_applications` stores structured applicant, availability, education, employment-history, experience, transportation, reference, and certification sections. Certification includes the version and server-authoritative wording. Status supports `new`, `reviewing`, `interview`, `offered`, `hired`, `rejected`, and `archived`. Signed submission IDs and payload digests make identical retries idempotent; changed-content retries do not silently overwrite an earlier application.

RLS is enabled with no anonymous read or write access. Both submission RPCs revoke PUBLIC/anon/authenticated execution and grant only service_role execution; the definer functions have an empty search path and fully qualified object references. The local admin migration adds restricted authenticated SELECT behind active staff permissions and MFA, separate hiring workflows, internal notes, search, and audit history. It grants no direct original-answer updates or deletes. Printing, interview scheduling, and retention/deletion policies remain future work.

A private rate-limit table enforces at most five saved applications per source per hour atomically across server instances. It stores a keyed IP hash, not a raw IP; old buckets are cleaned during submissions after 24 hours. Vercel's forwarded client IP is used only on Vercel; outside Vercel, clients share a conservative bucket unless a trusted host-specific adapter is added. A botnet can still distribute traffic: review hosting abuse controls before enabling at scale. No applicant data, tokens, or database response bodies are logged by application code.

Before production activation: configure server variables after approval, test saving and failures in staging, define applicant-data retention, and review the public application/certification against the source document. No hosted migrations, Auth changes, or production submissions were made by this implementation.

Local application validation tests: `node --test tests/employment.test.mjs`. These use synthetic data and stubbed storage; they do not connect to hosted Supabase.

### Employment regression checks

Run `npm run test:employment` for shared validation and retry regressions. After `npm run build`, run `npm run test:employment:browser` for all eight steps at normal and 200% text sizes, certification timing, date/time validation, interrupted/lost-response recovery, automatic draft saving, expiry, recovery, storage failure handling, and quote regression. Browser tests start an isolated localhost backend and never use Supabase credentials or save real applications. They use installed Chrome on macOS; elsewhere run `npx playwright install chromium` or set `EMPLOYMENT_TEST_BROWSER_PATH` to a Chromium executable.

Recoverable submission transport errors retain the mounted form and its signed token. Identical retries confirm the original saved application rather than inserting another. Entries recover across refreshes and tab closure when device storage is available. Confirmed submission clears the draft. Within-session retries keep the same signed token. After a reload of an unconfirmed submission, answers can be reviewed but submission is blocked pending confirmation with the business; a fresh token cannot silently duplicate a potentially saved application. Availability supports overnight hours; identical start/end times require correction. Prior-employment start months cannot be in the future.

## Local staff portal — Phase 1

The private web portal is at `/admin`. Public pages and the existing submission paths remain separate. Staff access is invitation-only: signing up for an ordinary Supabase account does **not** create a staff membership.

### Authentication and permissions

Configure the server-only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (or legacy `SUPABASE_ANON_KEY`) in the ignored `.env.local`. The admin client rejects secret/service-role keys. It uses the official Supabase SSR cookie client, HttpOnly SameSite=Lax cookies scoped to `/admin`, verified Auth users, and fresh database permissions. The dedicated `sb-jb-squeaky-admin-auth` cookie name prevents collisions with other local Supabase apps; changing to this name requires signing in again. Production HTTPS uses Secure cookies. The Next.js proxy refreshes sessions and disables admin response caching; each protected page/data function/action independently enforces authorization.

An active `staff_memberships` row and verified TOTP **AAL2** are required. Administrator and manager roles can read the dashboard, quotes and applications, update statuses and add notes. Employees, customers, and suspended staff cannot access these records. Export and staff-management permissions are reserved for administrators; their UI is outside this milestone. Changing database memberships or role permissions takes effect for existing sessions without relying on client state. Auth MFA enrollment is the sole pre-AAL2 staff-only setup exception.

The additive `20261009230000_create_admin_portal.sql` migration creates role/permission/membership tables, separate quote/application workflows, staff-only notes and immutable audit events. Every new table has RLS. Authenticated clients receive read grants only where RLS permits. Mutations are permission-checked database functions that derive `actor_id` from `auth.uid()` and write changes/audits atomically. No original quote or applicant answer is updated. Original employment `status` is also untouched; the separate workflow defaults to `new`. Signing tokens/digests are excluded from the staff application projection.

### Local validation

Only use the local Docker Supabase stack. Verify `npx supabase status` reports `http://127.0.0.1:54321` before any writes. Apply migrations with `npx supabase db push --local --dry-run`, inspect the list, then `npx supabase db push --local`. Do not reset or use a linked/remote push. Local TOTP is enabled in `supabase/config.toml`; this does not alter hosted Auth.

Run `npm run test:admin` for unit tests. After `npm run build`, run `ADMIN_LOCAL_TESTS=1 npm run test:admin:local` for real local Auth/MFA/RLS/browser tests. This opt-in suite refuses hosted URLs, creates synthetic users and new synthetic submissions, and **retains** them. Its isolated Next.js test process gets a fresh in-memory employment signing secret so repeated runs do not reset or exhaust the developer server's shared rate-limit bucket; `.env.local` is unchanged by tests. It never deletes existing records. It temporarily suspends its synthetic manager and removes/restores that role's local quote-management permission to test revocation; do not run concurrently with manual local admin work. Browser tests use the installed Google Chrome. No test credentials are printed or added to the repository. The existing `test:employment` and `test:employment:browser` suites remain available.

### Provisioning and production preparation (not performed)

There is no registration endpoint or staff-permissions UI. For a first administrator, a trusted operator must verify the intended project and approved recipient. Use the privileged Admin Auth API to generate an invite link without sending it, obtain its user ID, and create that user's explicit active administrator membership using a privileged database session. Deliver the invite only after membership provisioning. The dashboard invite flow sends immediately, so provision its returned membership promptly; early redemption fails closed until membership exists. Never infer authorization from email domains, public user metadata, or authentication alone. Confirm the recipient before provisioning; enrollment and TOTP verification must complete before any data access.

For the staff invitation flow, configure the Supabase invite email template to link to `{{ .SiteURL }}/admin/auth/confirm?token_hash={{ .TokenHash }}&type=invite`, configure the approved site/redirect URLs, and send invitations only after membership provisioning. This fixed-destination callback verifies the invite and membership, then takes the user to `/admin/setup` to choose a password and `/admin/mfa` to enroll. Do not use arbitrary return URLs. Test actual invitation delivery, expired invitations, recovery and staff suspension before production activation. Password-recovery/account lifecycle tools are future work; no public staff signup is provided.

Production requires separate approval to apply the admin migration, configure the least-privilege key, enable hosted TOTP enrollment/verification, review Auth/email security settings, provision the first real administrator, and deploy. **Keep `EMPLOYMENT_APPLICATIONS_ENABLED` absent or false in production.** This admin work does not activate public employment submissions. Do not copy local credentials or synthetic users to production. Existing server-only public submission credentials remain unchanged.
