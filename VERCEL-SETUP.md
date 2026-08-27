# Vercel setup

This repository has one deployment path: Vercel. `vercel.json` is the only
routing file. There is no framework, build step or output directory; Vercel
serves the repository root as static files.

## What is in the repository

| File | Purpose |
|---|---|
| `vercel.json` | Routes, redirects, security and cache headers |
| `.vercelignore` | Keeps `qa/`, `apps-script/` and markdown off the public site |
| `apps-script/Code.gs` | Google Apps Script receiver for form steps 1 and 2 only |
| `assets/site.js` | Lead form, Cal.com inline embed, Cal event UI and shared behaviour |
| `assets/site-v4.css` | Shared visual system, including responsive embed sizing |

The former Google Calendar verifier, its polling endpoint, its trigger manifest
and its server-side conversion backfill are not part of this repository or the
booking flow.

## 1. Create the project

1. Sign in at <https://vercel.com> and choose **Add New… → Project**.
2. Import `Genius-CFO/website` from GitHub.
3. Set Framework Preset to **Other**.
4. Leave Build Command, Output Directory and Install Command empty.
5. Deploy.

Vercel reads `vercel.json` on every deployment. The first deploy lands on a
`*.vercel.app` URL, where the full flow can be checked before DNS changes.

## 2. Point `geniuscfo.ai` at it

In **Project → Settings → Domains**, add `geniuscfo.ai`. Use the DNS records
Vercel displays; they are authoritative over copied values in documentation.
They are typically:

- `geniuscfo.ai` → `A` → `76.76.21.21`
- `www.geniuscfo.ai` → `CNAME` → `cname.vercel-dns.com`

Set `geniuscfo.ai` as the primary domain and redirect `www` to it. Canonical
tags, the sitemap and `llms.txt` all use the bare apex.

## 3. Lead form and Google Sheet

`assets/site.js` has one Apps Script URL: `LEAD_ENDPOINT`. It belongs to the
existing **GCFO leads** receiver and writes to the linked **Leads** Sheet.

- Step 1 appends the contact record.
- Step 2 finds the newest row with the same phone number and adds the triage
  answers.
- Neither step is a conversion.
- Localhost and `127.0.0.1` suppress live Sheet writes for safe visual QA.

The source copy is `apps-script/Code.gs`. For a receiver update, change the
bound Sheet script, create a new web-app deployment, and copy its `/exec` URL
into `LEAD_ENDPOINT`. A GET to that URL should return:

```json
{"ok":true,"service":"geniuscfo-leads"}
```

Fields posted are `name`, `phone`, `email`, `company`, `turnover`, `role`,
`track`, `whatsapp_optin`, `whatsapp_consent_source`,
`whatsapp_consent_timestamp`, `interested_plan`, `landing_audience`,
`landing_path`, `page`, `referrer`, `timestamp`, `step`, `challenge`,
`accounting_tool`, `client_accounting_tool`, `client_count`, `utm_source`,
`utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`, `fbclid` and
`msclkid`.

The browser uses `mode:"no-cors"`, so a real deployed test submission and a
single completed Sheet row are the final proof that both writes succeeded.

## 4. Cal.com inline booking

Step 3 on `/business` and `/ca-firms` uses one Cal.com event type:

| Setting | Value |
|---|---|
| Public link | <https://cal.com/geniuscfo/30min> |
| Cal event type ID | `6836794` |
| Embed namespace | `30min` |
| Layout | Month view |
| Small screens | Slots view enabled |
| Light-theme brand colour | `#00674D` |
| Dark-theme brand colour | `#00C896` |

The embed is initialised only when Step 3 opens. This keeps the initial page
light and avoids rendering a cross-origin booking app inside a hidden step.
The official `linkReady`, `bookerReady` and `linkFailed` events control the
visible loading and recovery messages. `bookingSuccessfulV2` updates the
on-page confirmation message.

The parent site deliberately does **not** push `generate_lead`. The Cal event
type already has the **Google Tag Manager** app enabled with tracking ID
`GTM-NPMFZCZG`. Cal sends `bookingSuccessfulV2` to that container; GTM maps the
event to GA4. Keeping a single analytics path prevents the parent page and the
Cal iframe from counting the same booking twice.

Cal documents `bookingSuccessfulV2` as the current event and the old
`bookingSuccessful` event as deprecated:
<https://cal.com/help/embedding/embed-events>.

If the inline app cannot load, the visitor gets a visible link to the same
Cal.com event type in a new tab. Because GTM is enabled on the Cal event type,
that fallback remains measurable.

## 5. Google Tag Manager

Two containers remain, but Cal booking confirmation uses the web container
only:

| Container | ID | Role |
|---|---|---|
| `geniuscfo.ai` (web) | `GTM-NPMFZCZG` | Browser and Cal.com events |
| `sGCFO` (server) | `GTM-PHDLBGGC` | Existing server-side Meta setup; not Cal confirmation |

### Web container contract

The Cal event type loads `GTM-NPMFZCZG`. The required wiring is:

1. Custom Event trigger **Cal.com — bookingSuccessfulV2** with event name
   `bookingSuccessfulV2`, firing on all matching custom events.
2. Existing tag **GA4 generate_lead**, event name `generate_lead`, firing on:
   - existing trigger **generate_lead_Custom Event**; and
   - **Cal.com — bookingSuccessfulV2**.

Do not create a second GA4 lead tag, do not use the deprecated
`bookingSuccessful` event, and do not trigger on a success-page URL. Cal uses
dynamic navigation, so the event is the reliable signal.

### Remove the old Calendar backfill

The server container must no longer contain the Google Calendar backfill:

- remove tag **GA4 — generate_lead (server backfill)**;
- remove trigger **GCFO — server backfill, GA4 copy**;
- remove variable **ED - gcfo_delivery**; and
- remove that trigger from the blocking exceptions on the existing
  **FB_CONVERSIONS_API-…-Server-Tag**.

Do not delete or otherwise change the existing Meta server tag. Its general
Conversions API role is separate from the retired Calendar verifier.

### Verify one real booking

1. Open GTM Preview for `GTM-NPMFZCZG`.
2. Complete form steps 1 and 2 on the deployed `/business` or `/ca-firms` page.
3. Complete one real booking in the inline Cal.com step.
4. Confirm Preview shows `bookingSuccessfulV2` and fires **GA4 generate_lead**
   exactly once.
5. Confirm GA4 DebugView receives one event named `generate_lead`.
6. Confirm Step 1, Step 2, viewing the calendar, changing months, choosing a
   slot and rescheduling do not fire `generate_lead`.

Delete or cancel the test booking after validation if it is not needed.

## 6. Check the deployed site

Against the `*.vercel.app` URL, and again after DNS moves:

| Request | Expected |
|---|---|
| `/` | 308 → `/business` |
| `/index.html` | 308 → `/business` |
| `/business` | 200, business page, no trailing slash |
| `/ca-firms` | 200, CA/firm page |
| `/pricing` | 200, shared pricing page |
| `/pricing.html` | 308 → `/pricing` |
| `/pricing?audience=business#business-plans` | 200, query string preserved |
| `/qa/v5-business-390.webp` | 404; QA evidence is not public |
| `/VERCEL-SETUP.md` | 404; handover documentation is not public |

`redirects` in `vercel.json` run before the filesystem, which makes `/` point
to `/business` even though a root `index.html` exists. `rewrites` then serve the
three clean public URLs from their physical HTML files. `cleanUrls` and
`trailingSlash` remain unset because generated rules would conflict with the
explicit root and legacy redirects.

## Still outstanding before launch

- Run the local mobile checks at 360, 390 and 430px, then desktop.
- Complete the real Cal.com booking test in GTM Preview and GA4 DebugView.
- Confirm the derived monthly equivalents for Pro, Pro Max and Enterprise.
- Re-verify answer-engine crawler tokens in `robots.txt`.
- Re-verify the competitor comparison table on `/business`.
- Run Lighthouse against the deployed site.
- Consider a Content-Security-Policy only after testing the inline GTM loader,
  Cal.com embed and lead-Sheet POST together.
