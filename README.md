# JB Squeaky Cleaners website

Next.js 16 App Router, TypeScript, React, and Tailwind CSS. Public pages: Home, Residential, Commercial, About, Gallery, and Request a Quote.

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

All contact and cleaning fields are validated again on the server. A hidden honeypot rejects basic automated submissions. Requests are saved to Supabase only; no notification email, booking, authentication, or dashboard is implemented. Review saved requests in Supabase. Before enabling a high-traffic public form, choose a persistent rate limit or CAPTCHA appropriate to your hosting setup.

The setup migration has not been applied to a remote database by this implementation. Credentials and a compatible table are required to enable storage; without them, call/email remain available.

## Branding and photography

Approved assets are served from `public/branding`. The native `app/favicon.ico`, Apple touch icon, and manifest icon references are preserved. The 10 supplied JPEGs under `public/images` are used without changing the original files. Only the kitchen is presented as a matched before/after pair. Bedroom images are explicitly labeled as before-only project views.

Keep changes local until reviewed. No deployment configuration is required for local review.
