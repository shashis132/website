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

When Step 3 opens, `site.js` hands a few values to the embed as config keys.
Cal turns every config key into a query parameter of the booking page, where
the same GTM container runs:

| Key | Source | Why |
|---|---|---|
| `name`, `email` | Step 1 fields | Prefill Cal's form; the web container reads them from the frame URL to attach user data to the lead |
| `li_fat_id` | URL parameter or the first-party cookie the LinkedIn Insight Tag sets | LinkedIn click attribution inside the third-party frame |
| `fbc`, `fbp` | `_fbc` and `_fbp` cookies on geniuscfo.ai | Meta click and browser ids for the server-side Lead |

None of these is a conversion event. `li_fat_id` is also preserved on internal
links alongside the UTM and click-id parameters.

Cal documents `bookingSuccessfulV2` as the current event and the old
`bookingSuccessful` event as deprecated:
<https://cal.com/help/embedding/embed-events>.

If the inline app cannot load, the visitor gets a visible link to the same
Cal.com event type in a new tab. Because GTM is enabled on the Cal event type,
that fallback remains measurable.

## 5. Google Tag Manager

Two containers. Both are edited through the GTM API (Stape MCP); this file is
the contract they must satisfy.

| Container | ID | Role |
|---|---|---|
| `geniuscfo.ai` (web) | `GTM-NPMFZCZG` | Loads on every site page **and inside the Cal.com booking page** (the Cal event type's Google Tag Manager app carries the same ID). Browser pixels, GA4, and the hand-off to the server container. |
| `sGCFO` (server) | `GTM-PHDLBGGC` | Stape tagging server `https://kfepwkvy.in.stape.io`. Meta Conversions API, LinkedIn Conversions API, GA4 forwarding. |

### How a booking becomes one lead

1. The visitor books inside the Cal.com frame. Cal's GTM app pushes
   `{ event: "bookingSuccessfulV2", uid, title, startTime, endTime, eventTypeId,
   status, paymentRequired, isRecurring }` to the frame's `dataLayer`. Cal does
   not include the attendee's name or email; the web container reads those from
   the frame URL, which `site.js` prefilled (section 4).
2. Web trigger **Cal.com — bookingSuccessfulV2** fires three tags:
   - **GA4 generate_lead** sends `generate_lead` to the server with
     `event_id`, `user_data` (email, first and last name), `x-fb-ck-fbp`,
     `x-fb-ck-fbc`, `booking_uid`, `booking_status` and `lead_source=cal.com`.
   - **FB_CONVERSIONS_API-…-Pixel_Template** sends the browser pixel event,
     which the **FBEventName** lookup maps to `Lead`, with the same `eventID`.
   - **LinkedIn Browser Lead** calls `lintrk('track', { conversion_id, event_id })`.
3. Server container, on `generate_lead`:
   - **FB_CONVERSIONS_API-…-Server-Tag** (fires on every event) maps
     `generate_lead` to Meta `Lead`; Meta deduplicates it against the browser
     pixel by `event_id`.
   - **LinkedIn CAPI — Lead** posts the conversion with the SHA-256 email,
     first and last name, and `li_fat_id` (read from the frame URL).
   - **GA4 — forward to Google Analytics** sends `generate_lead` to
     `G-89VFSF4RV7`. Without this tag nothing routed through the tagging server
     reaches GA4.

The event id is `cal_<booking uid>` for booking events and GTM's per-event id
otherwise (**Cal.com — event_id**). The raw `bookingSuccessfulV2` event is
**not** forwarded to the server any more (exception on the generic GA4 event
tag); `generate_lead` is the single canonical lead event.

### Web container contract

Variables added for the lead:

| Variable | Type | Value |
|---|---|---|
| Cal.com — booking uid / booking status | Data Layer | `uid` / `status` from Cal's push |
| URL — email, URL — name, URL — fbc, URL — fbp | URL query | Frame URL parameters set by `site.js` |
| Cal.com — first name / last name | Custom JavaScript | Split of `URL — name` |
| Cal.com — user_data | Custom JavaScript | `{ email, email_address, address: { first_name, last_name } }` or undefined |
| Cal.com — event_id | Custom JavaScript | `cal_<uid>` on `bookingSuccessfulV2`, else the existing Event_ID_Constant |
| FB — fbp (iframe-aware), FB — fbc (iframe-aware) | Custom JavaScript | Frame URL value, else the `_fbp` / `_fbc` cookie |
| LinkedIn — Conversion ID | Constant | LinkedIn conversion rule used by the browser Insight Tag call |

Tag wiring:

- **GA4 generate_lead** fires on **generate_lead_Custom Event** and
  **Cal.com — bookingSuccessfulV2** and carries the parameters listed above.
- **FB_CONVERSIONS_API-…-Web-Tag-GA4_Event** has
  **Cal.com — bookingSuccessfulV2** as an exception and uses the iframe-aware
  fbp/fbc variables.
- **FB_CONVERSIONS_API-…-Web-Tag-Pixel_Template** uses **Cal.com — event_id**
  as its Event ID; **FBEventName** maps `bookingSuccessfulV2 → Lead`.
- **LinkedIn Browser Lead** fires on both triggers and passes `event_id`.

Do not create a second GA4 lead tag, do not use the deprecated
`bookingSuccessful` event, do not trigger on a success-page URL, and do not push
`generate_lead` from the parent page.

### Server container contract

- Template **LinkedIn Conversion API (Stape)** imported from
  `github.com/stape-io/linkedin-tag`.
- Constants **LinkedIn — CAPI access token** (the token lives only in GTM;
  never commit it) and **LinkedIn — Conversion ID (Lead)**.
- Triggers **GA4 — generate_lead**, **GA4 — page_view**, and
  **GA4 — all events except gtm.dom and page_view**.
- Tags **LinkedIn CAPI — Lead** (conversion, auto-mapping on),
  **LinkedIn CAPI — PageView** (stores `li_fat_id` from the URL into a cookie;
  no browser pixel), and **GA4 — forward to Google Analytics**.
- **FB_CONVERSIONS_API-…-Server-Tag** is unchanged. Its template carries a
  local `bookingSuccessfulV2 → Lead` mapping; it is harmless because the web
  container no longer forwards that raw event.

### LinkedIn Campaign Manager

The access token comes from **Data → Sources → Google Tag Manager → Generate
token** and expires; regenerate it there and update the constant when LinkedIn
starts rejecting requests. The conversion rule referenced by
**LinkedIn — Conversion ID (Lead)** must accept Conversions API events. If the
existing Insight Tag rule does not, create a conversion of type **Lead** with
**Conversions API** as its source under **Analyze → Conversion tracking** and
put its numeric Conversion ID in the constant. LinkedIn deduplicates the
browser and server events by `event_id`.

### Verify one real booking

Tag Assistant cannot see inside the embedded frame from geniuscfo.ai, so
preview the container on the booking page itself.

1. In GTM, open Preview for `GTM-NPMFZCZG` and connect it to
   `https://cal.com/geniuscfo/30min?name=Test%20Lead&email=you@example.com`.
2. Complete one real booking. Preview must show `bookingSuccessfulV2` firing
   **GA4 generate_lead**, the pixel tag and **LinkedIn Browser Lead** exactly
   once, with `Cal.com — event_id` = `cal_<uid>` and `Cal.com — user_data`
   populated.
3. In the server container's Preview, the `generate_lead` request must fire
   **FB_CONVERSIONS_API-…-Server-Tag**, **LinkedIn CAPI — Lead** and
   **GA4 — forward to Google Analytics**.
4. Meta Events Manager → dataset GCFO → Test Events: one `Lead` from the
   browser and one from the server with the same event id, shown as
   deduplicated.
5. LinkedIn Campaign Manager → Analyze → Conversion tracking: the rule shows a
   recent Conversions API event.
6. GA4 DebugView: one `generate_lead` with `booking_uid`.
7. Steps 1 and 2, opening the calendar, changing months, choosing a slot and
   rescheduling must not raise a lead.

Delete or cancel the test booking after validation. Mark `generate_lead` as a
key event in GA4 Admin → Events if it is not already.

### Known follow-ups (not part of the lead flow)

- Three Google tags configure `G-89VFSF4RV7` (**G-89VFSF4RV7** on
  Initialization, **GA4 page_view** on All Pages, and the Meta-generated config
  with `transport_url` on DOM Ready). GA4 page views are likely double counted
  and Meta receives an extra server PageView per page. Consolidate to one
  Google tag on Initialization that sets `transport_url`, then forward
  `page_view` from the server.
- The tagging server uses the default `*.in.stape.io` host, so cookies it sets
  (FPID, `li_fat_id`) are third-party. Map a `geniuscfo.ai` subdomain in Stape
  and update `transport_url`.

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
- Complete the real Cal.com booking test in GTM Preview, Meta Test Events,
  LinkedIn Campaign Manager and GA4 DebugView (section 5).
- Confirm the LinkedIn conversion rule accepts Conversions API events.
- Confirm the derived monthly equivalents for Pro, Pro Max and Enterprise.
- Re-verify answer-engine crawler tokens in `robots.txt`.
- Re-verify the competitor comparison table on `/business`.
- Run Lighthouse against the deployed site.
- Consider a Content-Security-Policy only after testing the inline GTM loader,
  Cal.com embed and lead-Sheet POST together.
