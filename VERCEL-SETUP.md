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
  has read-only Calendar access, owns the public booking status endpoint, and
  sends the conversion itself when the visitor's browser cannot.

This split preserves the working Sheet integration even though
`marketing@geniuscfo.ai` has Viewer access to the old Apps Script project and
Comment-only access to its Sheet.

### Why the conversion works the way it does

Google Calendar's appointment-schedule embed is a cross-origin iframe. It emits
nothing to the parent page when a booking completes — no `postMessage`, no
redirect, no readable state. Calendly and Cal.com do; Google does not. The
Calendar event the schedule creates is therefore the only truthful signal that
a booking happened, and everything below exists to turn that event into exactly
one `generate_lead`.

The website flow is:

1. Step 1 validates and saves contact details. Email is mandatory.
2. Step 2 saves the triage answers in the same row, and separately registers
   the browser `lead_id` with the booking verifier as `pending`, along with the
   browser's advertising identity — GA4 `client_id` and `session_id` from the
   `_ga` cookies, Meta `_fbp` and `_fbc`, and the user agent. No name or email
   is sent to the verifier.
3. Step 3 opens the real Google Calendar appointment schedule.
4. The verifier checks Calendar every minute using read-only access.
5. While Step 3 remains open, the page polls the status and pushes
   `generate_lead` once the booking is confirmed, then tells the verifier it
   has done so.
6. If no such acknowledgement arrives within 90 seconds, the verifier sends the
   conversion into the server container itself.

Neither a Step 1 nor a Step 2 submission is a conversion.

### Correlation is by time, not identity

Earlier versions matched the booker's Google account against the form's name
and email, and deliberately abstained when that was ambiguous. That meant a
booking made from a different Google account, or two bookings inside the same
half hour, produced **no conversion at all**. That identity matching is gone.

A new booking event claims the pending lead whose Step 2 submission sits
nearest to it in time, within `CLAIM_LOOKBEHIND_MINUTES` (45) before and
`CLAIM_LOOKAHEAD_MINUTES` (10) after, and never abstains. Time is used to
attribute the booking to the right browser session for ad reporting — not to
prove who booked. A booking with no pending lead in the window, from someone
who used the direct calendar link rather than the form, still counts: it
becomes an `orphan_…` record flagged `attribution: unmatched`. Set
`EMIT_UNMATCHED_BOOKINGS = false` to count only funnel bookings.

The consequence worth understanding: with two visitors booking minutes apart,
each booking is credited to a real session, but not necessarily to the session
that made it. Both conversions are counted; the ad click they are attributed to
can be swapped. That is the deliberate trade for never losing one.

### Exactly-once delivery

The browser is the fast path and the server is the backfill, and only one of
them delivers:

- The page fires `generate_lead`, then POSTs `action=conversion-reported`. The
  verifier records that and stands down.
- If nothing arrives within `SERVER_BACKFILL_DELAY_MS` (90 s), the verifier
  sends the event itself and marks the record. From then on `booking-status`
  returns `delivered` rather than `confirmed`, so a page that comes back later
  stops polling without firing a second copy.
- Losing the acknowledgement costs a duplicate, not a miss. Both copies carry
  the same `event_id`, derived from the Calendar event ID, so Meta collapses
  them; GA4 has no event-level dedupe, which is why the acknowledgement and the
  `delivered` status both exist.

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
- Trigger: one **one-minute**, time-based `syncConfirmedBookings` trigger
- OAuth scopes: Calendar read-only, offline trigger execution, and
  **external requests** — the last one is new, and without it the server-side
  backfill cannot reach the server container

For a code update, copy `apps-script/BookingVerifier.gs` into `Code.gs` and
`apps-script/appsscript.json` into the manifest, save, then use **Deploy →
Manage deployments → Edit → New version**. Do not create another deployment;
updating the active deployment preserves `BOOKING_ENDPOINT`. The new scope
forces a fresh authorisation prompt on the first run — accept it, or every
backfill fails silently in **Executions**.

Run `installBookingTriggers` after deploying. It removes old verifier triggers
before creating exactly one replacement, now at one minute rather than five.

The base URL must return
`{"ok":true,"service":"geniuscfo-booking-verifier"}`. A request with
`?action=booking-status&lead_id=not-a-real-lead&callback=gcfoTest` must return a
JSONP `pending` response.

`node apps-script/BookingVerifier.test.cjs` runs the unit tests, which cover
concurrent bookings, idempotent re-scans, orphan bookings, the acknowledgement
path and partial delivery failure. Run it before every deployment.

## 4. Google Tag Manager

Two containers:

| Container | ID | Role |
|---|---|---|
| `geniuscfo.ai` (web) | `GTM-NPMFZCZG` | Everything the browser fires |
| `sGCFO` (server) | `GTM-PHDLBGGC` | `https://kfepwkvy.in.stape.io` |

`GTM-NPMFZCZG` is installed on all four HTML files — the loader high in `<head>`
and the `<noscript>` iframe immediately after `<body>`. It has an exact-match
custom-event trigger for `generate_lead` firing a GA4 lead tag, a LinkedIn lead
tag, and the Meta Pixel. The confirmed Meta Pixel/Dataset ID is
`26539065255760528`; do not replace it or add a duplicate base tag.

`assets/site.js` emits `lead_step1_complete` and `lead_step2_complete` for
funnel diagnostics, and emits `generate_lead` only once the verifier reports a
confirmed booking. The event carries the server-derived `conversion_event_id`
as `event_id` and puts no contact details in `dataLayer`.

### The server-side backfill

When the verifier delivers a conversion itself it sends **two** hits to
`https://kfepwkvy.in.stape.io/g/collect`, shaped like the gtag request the
browser would have sent, so the container's existing GA4 client claims them
with no new template. Two, because the destinations disagree about the event
name: the GA4 client hands `ep.event_name` to every tag, and the Meta
Conversions API tag reads its event name from there — which is how the web
relay tag already talks to it.

| Hit | `ep.gcfo_delivery` | Event name | Reaches |
|---|---|---|---|
| GA4 copy | `server_ga4` | `generate_lead` | GA4 tag only |
| Meta copy | `server_meta` | `Lead` | Meta CAPI tag only |

Added in the server container to make that work:

- Variable **ED - gcfo_delivery** — event data key `gcfo_delivery`.
- Trigger **GCFO — server backfill, GA4 copy** — `gcfo_delivery` equals
  `server_ga4`.
- Tag **GA4 — generate_lead (server backfill)** — fires on that trigger.
- The existing **FB_CONVERSIONS_API-…-Server-Tag** gained that same trigger as
  a **blocking** trigger, so the GA4 copy never reaches Meta. Nothing else
  about that tag was changed.

The Meta copy replays the visitor's `_fbp`, `_fbc` and user agent, so Meta can
still attribute the booking to the ad click that produced it. The visitor's IP
cannot be replayed — Apps Script never sees it — so Meta will record Google's.
That costs some match quality on backfilled events only, and applies to events
that would previously have been lost entirely.

### Known issue: the web container never reaches the server container

Verified in the browser on 26 Aug 2026 against the live site: **no request from
geniuscfo.ai reaches `kfepwkvy.in.stape.io`.** Every GA4 hit, including the
`FB_CONVERSIONS_API-…-Web-Tag-GA4_Event` relay that is supposed to feed the Meta
Conversions API tag, goes straight to `www.google-analytics.com`.

The cause is two Google tags configuring the same measurement ID with different
transports: tag `G-89VFSF4RV7` fires on Initialization with no `transport_url`,
and `FB_CONVERSIONS_API-…-Web-Tag-GA4_Config` fires on DOM Ready with
`transport_url` set to the Stape URL. The first one wins.

Consequences today: Meta receives browser-pixel events only, the Conversions API
tag has never fired, and the `event_id` minted for deduplication has never had a
server-side counterpart to deduplicate against. The booking backfill above is
unaffected — it posts to the server container directly — but the rest of the
site's server-side tagging is inert until this is resolved.

Separately, every `/g/collect` request observed in that session returned **HTTP
503**. Confirm in GA4 Realtime whether live traffic is being recorded at all
before reading anything into conversion counts.

### Verifying a real booking

Verifying is not optional. The Sheet POST uses `mode:"no-cors"`, so the browser
never sees whether the write succeeded and the site cannot tell you it failed.

1. Submit one real lead on the deployed site and confirm a single row appears in
   the **Leads** tab with both the Step 1 and Step 2 values.
2. **Tab open.** Book a real test slot, including from a different Google
   account, and keep Step 3 open. Within about a minute the page should change
   to the booked state and emit exactly one `generate_lead`. In the verifier's
   **Executions**, that record should show `browser_reported_at` and no
   `server_sent_*` timestamps.
3. **Tab closed.** Book a second slot and close the tab immediately. Within
   about three minutes the record should show `server_sent_ga4_at` and
   `server_sent_meta_at`, GTM server Preview should show the two hits landing
   on their intended tags and nothing else, and Meta Test Events should show one
   **Lead**.
4. Reopen the booking page with the same browser afterwards. It must show the
   booked state and fire nothing.

If the Sheet write fails, inspect **GCFO leads → Executions**; if booking
confirmation or delivery fails, inspect **GeniusCFO Booking Verifier →
Executions**.

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
