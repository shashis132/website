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
`utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`, `fbclid`,
`msclkid` and `li_fat_id`. `li_fat_id` is new; the bound Apps Script drops
unknown fields, so redeploy `apps-script/Code.gs` (which now lists it) if the
sheet should keep the LinkedIn click id.

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
the same GTM container runs. Nothing personal travels in clear text:

| Key | Source | Why |
|---|---|---|
| `em`, `ph`, `fn`, `ln` | SHA-256 of the Step 1 email, phone (`91` + 10 digits) and first / last name, hashed in the browser | Customer identifiers in the form Meta and LinkedIn match on |
| `li_fat_id` | URL parameter, the session copy, or the first-party cookie the LinkedIn Insight Tag sets | LinkedIn click attribution inside the third-party frame |
| `fbc`, `fbp` | `_fbc` and `_fbp` cookies on geniuscfo.ai (`fbc` is synthesised from a known `fbclid` when the cookie is absent) | Meta click and browser ids for the Lead |
| `ga_cid` | Client id from the `_ga` cookie | Keeps the frame's GA4 hits on the same user as the parent page |

Cal's form is not prefilled: the visitor's name and email would otherwise sit
in a URL that every tag in the frame reports. The new-tab fallback link
carries the same keys. None of these is a conversion event. `li_fat_id` is
also preserved on internal links alongside the UTM and click-id parameters.

Cal documents `bookingSuccessfulV2` as the current event and the old
`bookingSuccessful` event as deprecated:
<https://cal.com/help/embedding/embed-events>.

If the inline app cannot load, the visitor gets a visible link to the same
Cal.com event type in a new tab. Because GTM is enabled on the Cal event type,
that fallback remains measurable.

## 5. Google Tag Manager

Two containers. Both are edited through the GTM API (Stape MCP); this file is
the contract they must satisfy. Rollback targets: web version 11 and server
version 8 are the last versions before this lead flow; server version 11 is
the current lead-flow version (rule id in place, duplicate LinkedIn tag removed).

| Container | ID | Role |
|---|---|---|
| `geniuscfo.ai` (web) | `GTM-NPMFZCZG` | Loads on every site page **and inside the Cal.com booking page** (the Cal event type's Google Tag Manager app carries the same ID). Browser pixels, GA4, and the hand-off to the server container. |
| `sGCFO` (server) | `GTM-PHDLBGGC` | Stape tagging server `https://kfepwkvy.in.stape.io`. Meta Conversions API, LinkedIn Conversions API, GA4 forwarding. |

### How a booking becomes one lead

1. The visitor books inside the Cal.com frame. Cal's GTM app pushes
   `{ event: "bookingSuccessfulV2", namespace, fullType, data: { uid, title,
   startTime, endTime, eventTypeId, status, paymentRequired, isRecurring } }`
   to the frame's `dataLayer`. Cal does not include the attendee's name or
   email; the hashed identifiers come from the frame URL (section 4).
2. Web trigger **Cal.com — bookingSuccessfulV2** fires three tags:
   - **GA4 generate_lead** sends `generate_lead` to the tagging server with
     `event_id`, `user_data` (SHA-256 email, phone, first and last name),
     `x-fb-ud-em/ph/fn/ln`, `x-fb-ck-fbp`, `x-fb-ck-fbc`, `li_fat_id`,
     `booking_uid`, `booking_status` and `lead_source=cal.com`.
   - **Meta Pixel — Cal.com booking Lead** sends the browser `Lead` with
     advanced matching (the same hashes) and the same Event ID.
   - **LinkedIn Browser Lead** calls
     `lintrk('track', { conversion_id, event_id })`.
3. Server container, on `generate_lead`:
   - **FB_CONVERSIONS_API-…-Server-Tag** (fires on every event) maps
     `generate_lead` to Meta `Lead`; Meta deduplicates it against the browser
     pixel by `event_id`.
   - **LinkedIn CAPI — Lead** posts the conversion to rule `30642209` with
     the SHA-256 email, `li_fat_id`, the visitor IP and `event_id`.
   - **GA4 — forward generate_lead to Google Analytics** sends the event to
     `G-89VFSF4RV7`. Without a forwarding tag nothing routed through the
     tagging server reaches GA4.

The event id is `cal_<booking uid>` for booking events and GTM's per-event id
otherwise (**Cal.com — event_id**). The generic Meta tags have
**Cal.com — bookingSuccessfulV2** and the deprecated
**Cal.com — bookingSuccessful (deprecated v1)** as exceptions, so the raw
booking event never reaches the server and `generate_lead` is the single lead
event. Bookings with `status` PENDING or `paymentRequired` still count as
leads; a repeat booking by the same person is a second lead (dedupe by email
in the sheet or CRM).

### Web container contract

Variables added for the lead:

| Variable | Type | Value |
|---|---|---|
| URL — em, ph, fn, ln, fbc, fbp, li_fat_id, ga_cid | URL query | Frame URL parameters set by `site.js` |
| Cal.com — data.uid / data.status | Data Layer | `data.uid` / `data.status` from Cal's push |
| Cal.com — event_id | Custom JavaScript | `cal_<uid>` on `bookingSuccessfulV2`, else the existing Event_ID_Constant |
| Cal.com — user_data (hashed) | Custom JavaScript | `{ sha256_email_address, sha256_phone_number, address: { sha256_first_name, sha256_last_name } }` or undefined |
| FB — fbp (iframe-aware), FB — fbc (iframe-aware) | Custom JavaScript | Frame URL value, else the `_fbp` / `_fbc` cookie |
| LinkedIn — Conversion ID (browser Insight Tag) | Constant | `26235820`, the rule the Insight Tag call fires |

Triggers added: **Cal.com — bookingSuccessful (deprecated v1)** (exception
only) and **Initialization — Cal.com frame with parent client id**
(hostname ending in `cal.com` and a `ga_cid` parameter, so the new-tab
fallback qualifies too).

Tag wiring:

- **GA4 generate_lead** fires on **generate_lead_Custom Event** and
  **Cal.com — bookingSuccessfulV2** with the parameters listed above.
- **Meta Pixel — Cal.com booking Lead** (standard event `Lead`, advanced
  matching em/ph/fn/ln, Event ID **Cal.com — event_id**) fires on
  **Cal.com — bookingSuccessfulV2**.
- **FB_CONVERSIONS_API-…-Web-Tag-GA4_Event** and
  **FB_CONVERSIONS_API-…-Web-Tag-Pixel_Template** keep their triggers and
  gain both Cal.com exceptions; the GA4 relay also has the dormant
  **generate_lead_Custom Event** trigger as an exception (so a future
  parent-page `generate_lead` push is owned by **GA4 generate_lead** alone),
  uses the iframe-aware fbp/fbc variables, and the pixel has pushState
  tracking disabled site-wide (harmless on a static site). A Meta
  partner-integration re-sync would overwrite these two tags; re-apply the
  exceptions if that happens.
- **LinkedIn Browser Lead** fires on both lead triggers and passes `event_id`.
- **G-89VFSF4RV7 — Cal.com frame client_id** (priority 10, `client_id` =
  `ga_cid`, `send_page_view` off) fires on the frame initialization trigger.

Do not create a second GA4 lead tag, do not use the deprecated
`bookingSuccessful` event, do not trigger on a success-page URL, and do not
push `generate_lead` from the parent page.

### Server container contract

- Built-in variable **Client Name** enabled.
- Template **LinkedIn Conversion API** (Stape's `github.com/stape-io/linkedin-tag`,
  imported from commit `76bbbec`; tests omitted, code unchanged, source noted
  in the template notes).
- Constants **LinkedIn — CAPI access token** (the token lives only in GTM;
  never commit it) and **LinkedIn — Conversion ID (Lead, Conversions API)**
  (`30642209`).
- Trigger **GA4 — generate_lead** (Event Name `generate_lead`, Client Name
  `GA4`).
- Tags **LinkedIn CAPI — Lead** (conversion, auto-mapping on) and
  **GA4 — forward generate_lead to Google Analytics**, both on that trigger.
- LinkedIn's Campaign Manager integration can drop its own tag, trigger and
  template into this container (named "LI … Website Lead CAPI 30642209",
  listening for `li_conversion_30642209`). Version 11 removed that pair; if
  it reappears, delete it again rather than wiring it to `generate_lead`, or
  the same booking would be posted twice to rule `30642209`.
- **FB_CONVERSIONS_API-…-Server-Tag** is unchanged. Its template carries a
  local `bookingSuccessfulV2 → Lead` mapping; it is harmless because the web
  container no longer forwards that raw event.

### LinkedIn Campaign Manager

LinkedIn binds a conversion rule to one data source and deduplicates browser
and server events by `event_id` across rules. The Insight Tag rule
`26235820` stays with the browser tag; the Conversions API rule `30642209`
receives the server event. Use only one of the two rules as the campaign key
conversion. To point the server at a different rule, change the constant
**LinkedIn — Conversion ID (Lead, Conversions API)** and publish.

The access token comes from **Data → Sources → Google Tag Manager → Generate
token** and expires; regenerate it there and update the constant when the
tag starts failing. The tag also sends the visitor's IP address as a LinkedIn
identifier (template default); disable **Automap User IDs** and map only
`email` and `linkedinFirstPartyId` if that is not wanted.

#### If the LinkedIn source stays "Unverified"

Campaign Manager marks the Google Tag Manager source verified only after
`api.linkedin.com` has accepted one conversion event sent with that source's
token; the rule then shows activity within a few hours. Check in this order:

1. The value of **LinkedIn — CAPI access token** was generated from that
   exact source (Data → Sources → Google Tag Manager → Generate token). A
   token from another source or app verifies that source instead.
2. Server Preview for one booking (step 4 below) shows **LinkedIn CAPI —
   Lead** as succeeded on the `generate_lead` request. "User IDs are
   missing" means the hit carried neither `user_data.sha256_email_address`,
   `li_fat_id` nor an IPv4 address: production must serve the current
   `site.js` and the visitor must complete Step 2 before booking. A 401 or
   403 response is the token; a 4xx naming `conversion` is the rule id.
3. LinkedIn's own "Google Tag Manager" setup wizard must not be run against
   these containers. It adds a `LI GA4 Event - …` web tag (measurement id
   `G-1234`) plus a second server template and tag, so each booking would
   reach LinkedIn twice without a shared event id. Those objects were removed;
   the Stape tag is the only sender.

### Verify one real booking

Production must serve the new `site.js` first: merge this branch, wait for the
Vercel deployment, and confirm
`https://geniuscfo.ai/assets/site.js?v=20260902-v4-lead` contains
`hashFields`. Tag Assistant cannot see inside the embedded frame, so use the
booking page itself.

1. Temporarily paste the Meta Test Events code into the server tag
   **FB_CONVERSIONS_API-…-Server-Tag** (Test Event Code) and publish, so the
   test Lead does not count in reporting; remove it afterwards.
2. On the deployed `/business` page complete Steps 1 and 2 with a two-word
   name, then use the "open the Cal.com booking page in a new tab" link. Its
   URL carries `em`, `ph`, `fn`, `ln`, `fbp`, `ga_cid` (and `fbc`,
   `li_fat_id` when known). Connect Tag Assistant to that URL and book.
3. Web Preview must show `bookingSuccessfulV2` firing **GA4 generate_lead**,
   **Meta Pixel — Cal.com booking Lead** and **LinkedIn Browser Lead** once
   each, with `Cal.com — event_id` = `cal_<uid>` and
   `Cal.com — user_data (hashed)` populated; the two FB_CONVERSIONS_API web
   tags must not fire on that event.
4. Server Preview: the `generate_lead` request fires
   **FB_CONVERSIONS_API-…-Server-Tag**, **GA4 — forward generate_lead to
   Google Analytics** and **LinkedIn CAPI — Lead**; check the incoming event
   shows `user_data.sha256_email_address` and `event_id`, and that the
   LinkedIn tag reports success (a 4xx means the token or rule id is wrong).
5. Meta Events Manager → GCFO → Test Events: one browser `Lead` and one
   server `Lead` with the same event id, marked deduplicated, with em/ph/fn/ln
   on the retained event.
6. GA4 DebugView: one `generate_lead` with `booking_uid`, on the same client
   id as the parent page's `page_view`.
7. LinkedIn Campaign Manager: rule `26235820` (Insight Tag) and rule
   `30642209` (Conversions API) each show the conversion, counted once.
8. Steps 1 and 2, opening the calendar, changing months, choosing a slot and
   rescheduling must not raise a lead.

Cancel the test booking afterwards (the conversions already recorded stay).
Mark `generate_lead` as a key event in GA4 Admin → Events, and add
`geniuscfo.ai` to the GA4 data stream's unwanted-referrals list so the
frame's session is not attributed to the site itself.

### Known follow-ups (not part of the lead flow)

- Three Google tags configure `G-89VFSF4RV7` (**G-89VFSF4RV7** on
  Initialization, **GA4 page_view** on All Pages, and the Meta-generated
  config with `transport_url` on DOM Ready). GA4 page views are likely double
  counted and Meta receives an extra server PageView per page. Consolidate to
  one Google tag on Initialization that sets `transport_url`, then forward
  `page_view` (and the enhanced-measurement events) from the server.
- The tagging server uses the default `*.in.stape.io` host, so cookies it sets
  (FPID, `li_fat_id`) are third-party. Map a `geniuscfo.ai` subdomain in Stape
  and update `transport_url`.
- Tracking runs without consent gating (no CMP). Adding one means switching
  the LinkedIn tag to "send data in case marketing consent given" and adding
  consent checks to the Meta and GA4 tags.

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
- Confirm the derived monthly equivalents for Pro, Pro Max and Enterprise.
- Re-verify answer-engine crawler tokens in `robots.txt`.
- Re-verify the competitor comparison table on `/business`.
- Run Lighthouse against the deployed site.
- Consider a Content-Security-Policy only after testing the inline GTM loader,
  Cal.com embed and lead-Sheet POST together.
