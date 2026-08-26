# Vercel setup

The host choice in `README.md` is now made: this repository is configured for
Vercel. `vercel.json` is the single routing file, and the Netlify configuration
(`_redirects`, `netlify.toml`, `netlify-build.sh`) has been removed, as
`DEVELOPER-HANDOFF.md` requires — one routing file per host, not alternatives.

## What is in the repository

| File | Purpose |
|---|---|
| `vercel.json` | Routes, redirects, security and cache headers |
| `.vercelignore` | Keeps `qa/`, `apps-script/` and the markdown off the public site |
| `apps-script/Code.gs` | Existing Google Apps Script receiver for the linked leads Sheet |
| `apps-script/BookingVerifier.gs` | Marketing-owned verifier for confirmed Calendar bookings |
| `apps-script/appsscript.json` | Explicit read-only Calendar and trigger scopes for the verifier |

There is no framework, no build step and nothing to compile. Vercel serves the
repository root as static files.

## 1. Create the project

1. Sign in at <https://vercel.com> and choose **Add New… → Project**.
2. Import `Genius-CFO/website` from GitHub.
3. Framework Preset: **Other**. Leave Build Command, Output Directory and
   Install Command empty — there is nothing to build, and setting an Output
   Directory would break the paths.
4. **Deploy.**

Vercel reads `vercel.json` on every deployment, so the routes and headers need
no configuration in the dashboard.

The first deploy lands on a `*.vercel.app` URL. Everything below can be verified
there before any DNS is touched.

## 2. Point `geniuscfo.ai` at it

In **Project → Settings → Domains**, add `geniuscfo.ai`. Vercel then shows the
records to create at your registrar — typically:

- `geniuscfo.ai` → `A` → `76.76.21.21`
- `www.geniuscfo.ai` → `CNAME` → `cname.vercel-dns.com`

Use the values Vercel displays; they are authoritative over this document.
Alternatively, move the nameservers to Vercel and let it manage the zone.

Set `geniuscfo.ai` as the **primary** domain, redirecting `www` to it — every
canonical tag, the sitemap and `llms.txt` use the bare apex. HTTPS is issued
automatically once DNS resolves.

## 3. Lead form, Google Sheet and confirmed bookings

`assets/site.js` deliberately uses two existing Apps Script services:

- `LEAD_ENDPOINT` remains the Shashi-owned **GCFO leads** receiver attached to
  the **GCFO ad campaign** spreadsheet. It keeps every form submission in the
  current linked **Leads** tab.
- `BOOKING_ENDPOINT` is the marketing-owned **GeniusCFO Booking Verifier**. It
  has read-only Calendar access and owns the public, non-sensitive booking
  status endpoint.

This split preserves the working Sheet integration even though
`marketing@geniuscfo.ai` has Viewer access to the old Apps Script project and
Comment-only access to its Sheet.

The website flow is:

1. Step 1 validates and saves contact details. Email is mandatory.
2. Step 2 saves the triage answers in the same row and separately registers the
   browser `lead_id`, name and email with the booking verifier as `pending`.
3. Step 3 opens the real Google Calendar appointment schedule.
4. The verifier checks Calendar every five minutes using read-only access.
5. While Step 3 remains open, the page checks the non-sensitive status and
   pushes `generate_lead` once when a matching booking becomes `confirmed`.

Neither a Step 1 nor a Step 2 submission is a conversion.

### Linked lead Sheet

`apps-script/Code.gs` is the source copy of the existing bound receiver. Step 1
appends the lead; Step 2 finds the newest matching phone number and fills in the
triage answers, so a completed flow stays in one row.

**Fields posted:** `name`, `phone`, `email`, `company`, `turnover`, `role`,
`track`, `whatsapp_optin`, `whatsapp_consent_source`,
`whatsapp_consent_timestamp`, `interested_plan`, `landing_audience`,
`landing_path`, `page`, `referrer`, `timestamp`, `step`, `challenge`,
`accounting_tool`, `client_accounting_tool`, `client_count`, plus `utm_source`,
`utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`, `fbclid`,
`msclkid`, and `lead_id`. The old receiver safely ignores the extra `lead_id`
field while continuing its phone-number update.

### Booking verifier deployment

The standalone **GeniusCFO Booking Verifier** project is owned by
`marketing@geniuscfo.ai`.

- Script ID: `1ngsAep5cRP1-MYj35_bgR9EQ_UEVXPgP60Izcu0JlLeXdoo9RkCi62jS`
- Web app: `https://script.google.com/macros/s/AKfycbxJFuCBN3CvwtZs3n3h733npfOEFQWtWbLfMJilF_ZZNwHzwrIzlQuwtXcGJb_R-rua/exec`
- Execute as: `marketing@geniuscfo.ai`
- Access: **Anyone**
- Trigger: one five-minute, time-based `syncConfirmedBookings` trigger
- OAuth scopes: Calendar read-only and offline trigger execution

For a code update, copy `apps-script/BookingVerifier.gs` into `Code.gs` and
`apps-script/appsscript.json` into the manifest, save, then use **Deploy →
Manage deployments → Edit → New version**. Do not create another deployment;
updating the active deployment preserves `BOOKING_ENDPOINT`.

Run `installBookingTriggers` only when the trigger is missing or must be reset.
It removes old verifier triggers before creating exactly one replacement.

The base URL must return
`{"ok":true,"service":"geniuscfo-booking-verifier"}`. A request with
`?action=booking-status&lead_id=not-a-real-lead&callback=gcfoTest` must return a
JSONP `pending` response.

The appointment title is normalized before matching, so the current
**Genius CFO Demo Call** title matches `BOOKING_TITLE_KEY`. A verifier record
changes to `confirmed` only when an active Calendar event has that title and
its creation time falls within the guarded Step 2 request window. Correlation
uses an exact attendee-email match first, then one unambiguous normalized
booker-name match, then a time-only fallback only when exactly one pending lead
is eligible. Ambiguous events remain pending rather than being guessed. The
stored record includes `matched_by` for private auditing, but the public status
response exposes no name, email, phone, match method, Calendar event ID or
appointment time. Pending and confirmed verifier records are removed after 45
days.

**Verifying is not optional.** The POST uses `mode:"no-cors"`, so the browser
never sees whether the write succeeded and the site cannot tell you it failed.
Submit one real lead on the deployed site and confirm a single row appears in
the **Leads** tab with both the Step 1 and Step 2 values. Book a real test slot,
including with a different Google account if desired, and keep Step 3 open for
up to five minutes. Confirm the page changes to the booked state and emits one
`generate_lead`. If the Sheet write fails, inspect **GCFO leads → Executions**;
if booking confirmation fails, inspect **GeniusCFO Booking Verifier →
Executions**.

## 4. Google Tag Manager

`GTM-NPMFZCZG` is installed on all four HTML files — the loader high in `<head>`
and the `<noscript>` iframe immediately after `<body>`. The current live
container already has an exact-match custom-event trigger for `generate_lead`,
a GA4 lead tag, LinkedIn lead tag, and a Meta mapping from that event to the
standard **Lead** event. The confirmed Meta Pixel/Dataset ID is
`26539065255760528`; do not replace it or add a duplicate base tag.

`assets/site.js` emits `lead_step1_complete` and `lead_step2_complete` for
funnel diagnostics, but emits `generate_lead` only after the Apps Script status
changes to `confirmed`. The event contains the server-derived
`conversion_event_id` as `event_id` and does not put the lead's contact details
in `dataLayer`.

After the Apps Script release and website deploy, verify one real booking in
GTM Preview and Meta Test Events. The expected order is Step 1 diagnostic →
Step 2 diagnostic → Calendar event created → `generate_lead`/Meta **Lead**.

## 5. Check the deployed site

Against the `*.vercel.app` URL, and again after DNS moves:

| Request | Expected |
|---|---|
| `/` | 308 → `/business` |
| `/index.html` | 308 → `/business` |
| `/business` | 200, the business page, no trailing slash |
| `/ca-firms` | 200, the CA/firm page |
| `/pricing` | 200, the pricing page |
| `/pricing.html` | 308 → `/pricing` |
| `/pricing?audience=business#business-plans` | 200, query string preserved |
| `/qa/lighthouse-v3-business.json` | 404 — QA evidence must not be public |
| `/DEVELOPER-HANDOFF.md` | 404 |

```sh
for p in / /index.html /business /ca-firms /pricing /pricing.html; do
  curl -s -o /dev/null -w "%{http_code} %{redirect_url}  $p\n" "https://YOUR-PROJECT.vercel.app$p"
done
```

### Why the config looks the way it does

`redirects` in `vercel.json` are evaluated **before** the filesystem, which is
what makes `/` → `/business` work even though a real `index.html` sits at the
root. `rewrites` are evaluated **after** the filesystem, so they only serve as a
fallback for the three clean URLs. Verified against Vercel's own routing library
(`@vercel/routing-utils`).

`cleanUrls` and `trailingSlash` are deliberately **not** set. Turning them on
inserts a generated `^/(.*)/$ → /$1` rule ahead of everything else, which
matches `/` itself and redirects the site root to itself; it also shadows the
explicit `/index.html` and `/pricing.html` rules. The three rules written here
do the whole job without that risk.

Redirects are `308` (Vercel's `"permanent": true`), not `301`. Both are
permanent and equivalent for search engines; 308 additionally preserves the
request method.

## Still outstanding before launch

These come from `DEVELOPER-HANDOFF.md` and `QA-SUMMARY.md` and are not resolved
by this setup:

- Confirm the derived monthly equivalents for Pro, Pro Max and Enterprise.
- Re-verify the answer-engine crawler tokens in `robots.txt`.
- Re-verify the competitor comparison table on `/business`.
- Run Lighthouse against the deployed site.
- Consider a Content-Security-Policy. `vercel.json` deliberately sets none: the
  pages carry inline JSON-LD and an inline GTM loader, and post to
  `script.google.com`, so a policy has to be authored against those and tested
  rather than guessed.
