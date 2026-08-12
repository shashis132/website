# GeniusCFO Website V3 — developer handoff

`README.md` is the entry point and route map. This document covers implementation details.

## Public routes

- `/business` → `business/index.html`
- `/ca-firms` → `ca-firms/index.html`
- `/pricing` → `pricing/index.html`

These are the only three public content pages. Business and CA/Firm are separate HTML documents. Pricing is one shared HTML document for both audiences. Root `index.html` is a redirect fallback, not a fourth page.

The three pages contain the approved August 2026 content and interaction rework. All primary copy, both billing amounts and FAQ answers remain in the HTML source.

The audience control uses normal links. The URL is authoritative; there is no audience `localStorage`, so an ad or email destination cannot be overridden by a previous visit.

## Deployment and clean URLs

Configure the host to serve the physical documents above at extensionless public URLs without trailing slashes. Canonical tags, social metadata, the sitemap and `llms.txt` already use those paths.

### Root redirect and legacy fragments

The host is Vercel. `vercel.json` is the routing file and the Netlify configuration has been removed; see `VERCEL-SETUP.md`. The rules permanently redirect `/` and `/index.html` to `/business` and redirect `/pricing.html` to `/pricing`.

`redirects` are evaluated before the filesystem, which is what lets `/` redirect despite the root `index.html` existing; `rewrites` are evaluated after it. Do not add `cleanUrls` or `trailingSlash`: they insert a generated `^/(.*)/$ → /$1` rule ahead of everything, which matches `/` and redirects the site root to itself, and they shadow the explicit `/index.html` and `/pricing.html` rules.

Fragments such as `#for-firms` are not sent to the server. A permanent root redirect cannot inspect them. Replace old root fragment links at their source with the new audience URLs. Root `index.html` retains client-side fragment handling only as a fallback for hosts that ignore the supplied routing configuration.

Do not redirect `/business` to `/business/`; the canonical style has no trailing slash.

## Marketing links and tracking

Business example:

`https://geniuscfo.ai/business?utm_source=meta&utm_medium=paid_social&utm_campaign=aug_launch_business&utm_content=founder_video`

CA/Firm example:

`https://geniuscfo.ai/ca-firms?utm_source=linkedin&utm_medium=paid_social&utm_campaign=aug_launch_ca_firms&utm_content=accounting_automation`

The shared script preserves:

- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- `gclid`, `fbclid`, `msclkid`

Pricing links also pass `audience=business` or `audience=ca-firms`.

## Lead form — live, three steps

The v2 placeholder form is gone. `/business` and `/ca-firms` now carry the three-step lead
flow ported from the current geniuscfo.ai landing page, rewritten in vanilla JS (no React).

**Steps**

1. Contact — name, business/firm name, mobile, optional email, role chips, annual turnover, consent.
2. Triage — branches on role. Business owners get *biggest challenge* + *accounting tool*.
   CA/vCFO firms get *client accounting tool* + *client count*.
3. Confirmation.

**Endpoint**

`LEAD_ENDPOINT` at the top of `assets/site.js` points at the Google Apps Script web app for the
new leads sheet. The URL carried over from the old landing page has been removed. The receiver
is `apps-script/Code.gs`; `VERCEL-SETUP.md` covers deployment and where the rows land.

If the constant is ever blanked the form still advances and nothing is posted; each submit logs
a console warning naming the missing endpoint.

Two POSTs are sent per lead — one on step 1, one on step 2 — carrying the same phone and email
so the sheet can merge them into one row. Requests use `mode:"no-cors"`; the opaque response is
expected and ignored, so a failed write is silent. **Submit one real lead and confirm the row
lands before launch**, and swap the constant if the script is redeployed (a redeploy changes
the `/s/…/exec` id).

**Payload fields**

`name`, `phone`, `email`, `company`, `turnover`, `role`, `track`, `whatsapp_optin`,
`whatsapp_consent_source`, `whatsapp_consent_timestamp`, `interested_plan`, `landing_audience`,
`landing_path`, `page`, `referrer`, `timestamp`, `step`, `challenge`, `accounting_tool`,
`client_accounting_tool`, `client_count`, plus all UTM and click identifiers.

`track` is `business` on `/business` and `practice` on `/ca-firms`.
`interested_plan` carries the plan the visitor had selected in the pricing selector, as
`business:pro/quarterly firm:team/monthly`.

**Attribution**

UTMs are read from the URL and persisted to `sessionStorage` under `gc_utm`, so a lead submitted
several pages after arrival still carries the campaign it came in on. This matches the current
landing page's behaviour.

**Google Tag Manager**

Container `GTM-NPMFZCZG` is installed on all four HTML files: the loader high in `<head>`, the
`<noscript>` iframe immediately after `<body>`. It initialises `dataLayer` before `site.js`
loads, so the events below are available to it. The tags themselves are configured in GTM.

**Analytics events pushed to `dataLayer`**

- `generate_lead` — step 1 submitted
- `lead_step2_complete` — step 2 submitted
- `pricing_plan_selected` — plan chosen in a selector
- `pricing_billing_toggled` — billing period switched

**Validation**

Client-side only: name and company required, mobile must match `^[6-9]\d{9}$`, email optional but
format-checked, consent required. Errors render into `[data-lead-error="…"]` nodes. Nothing is
POSTed until step 1 validates.

## Product images and image viewer

- Business and CA/Firm product images are in `assets/screens/`.
- The new Business captures come from working routes in the supplied GeniusCFO application: Executive Dashboard, Ask GeniusCFO, GST Workspace, Bank Reconciliation and the phone interface. The three files beginning `business-alert-` are cropped Executive Dashboard insight panels. `business-home-mobile-clean` is the phone capture prepared without the page-level scrollbar.
- The Business capture files begin with `business-`. The optimized `.webp` files are used in `<picture>` elements and the source `.png` files are retained for full-size inspection.
- Each image is a normal link with `data-lightbox`; the shared script opens it in the native `<dialog>` viewer.
- Do not remove the anchor `href`: it provides a full-image fallback when JavaScript is unavailable.
- On mobile, the dialog keeps the source image at inspection size and permits horizontal scrolling.
- Captions describe the task shown. No authenticity, status or illustrative-data labels are required under the approved feedback.

## Pricing — plan selector

The v2 comparison tables and Monthly/Annual toggle are gone. Pricing now uses a plan selector
that mirrors the in-app pricing model from `app.geniuscfo.ai/#pricing`, re-skinned into the
site's ruled/ledger language.

**Structure** — `[data-plan-selector="business|firm"]` contains a billing switch, a selected-plan
figure block, and a `role="radiogroup"` of `.plan-option` labels.

- Billing is **Monthly** or **3 months**. 3 months is the default and saves 20%.
- The large figure shows the selected plan's monthly price, or its monthly *equivalent* on the
  3-month plan, plus the GST-inclusive total.
- Selecting a plan appends `?plan=…&billing=…` to that block's Book-a-demo CTA and writes the
  choice into the lead form's `interested_plan` field.
- The landing page **reads `?plan=` and `?billing=` back** on load and preselects the matching
  option and period, so the plan chosen on `/pricing` survives the jump to `/business#demo` or
  `/ca-firms#demo` and reaches the sheet as `interested_plan`. `plan` must match a
  `data-plan-id`; `billing` accepts `monthly`, `3-month` or `quarterly`. An unknown or absent
  value falls back to the markup default.
- Each block initialises independently; switching one does not affect the other.

**Prices live in the markup**, as `data-*` attributes on each `.plan-option`:

`data-monthly-display` · `data-monthly-note` · `data-monthly-copy` · `data-monthly-total`
`data-quarterly-display` · `data-quarterly-note` · `data-quarterly-copy` · `data-quarterly-total`
`data-quarterly-monthly`

Update prices there — never only in `assets/site.js`. Every value traces to
`August Pricing Page Reference/pricing-page-reference/pricing-content.json` (captured 11 Aug 2026).

**Without JavaScript** the 3-month price, plan names, scope lines and feature lists all remain
readable; only the switching and the live figure stop working.

**Derived figures.** The source data supplies a monthly equivalent only for Light (₹799) and
Team (₹3,199). Pro (₹1,599), Pro Max (₹2,399) and Enterprise (₹5,599) are computed with the same
rule — 3-month ex-GST price ÷ 3, rounded down. Confirm these before launch.

## Editable content locations

- Business copy, FAQs, structured data and comparison: `business/index.html`
- CA/Firm copy, FAQs, structured data and plans: `ca-firms/index.html`
- Shared pricing, managed services and add-ons: `pricing/index.html`
- Managed services also appear at the end of `business/index.html`; keep the two copies in step
- Shared layout, responsive behaviour and component styles: `assets/site.css`
- Tracking preservation, plan selector, lead form, Ask GeniusCFO examples and image viewer: `assets/site.js`
- Footer wordmark: `assets/logo-wordmark-dark.svg` (transparent; do not add a background rectangle)

## Search and answer layer

Three layers, kept deliberately separate: **SEO** (can a crawler reach and index it), **AEO**
(can an engine lift a correct answer out of it), **GEO** (can a generative system identify the
entity and cite it).

**SEO**

- Each route has a distinct title, description, canonical URL, Open Graph/X metadata, one H1 and a
  single unified JSON-LD `@graph`.
- `sitemap.xml` carries `lastmod`, `changefreq` and `priority`. Update `lastmod` whenever a page's
  content changes; a stale `lastmod` is worse than none.
- `robots.txt` names the major search *and* answer-engine crawlers explicitly. **Re-verify those
  user-agent tokens before launch** — vendors rename and add crawlers, and an obsolete token
  silently does nothing.

**AEO**

- Every page answers its questions answer-first: a question heading, then a self-contained
  25–50-word factual answer, then the proof, table or detail.
- `/pricing#plan-summary` is the canonical crawlable price answer. **All plan prices must exist as
  real text there.** The plan selector renders monthly prices from `data-*` attributes only, so
  without that table an engine asked "what does GeniusCFO cost per month?" would read the 3-month
  figure (₹2,398) instead of ₹999. If you change a price, change it in **three** places: the
  `.plan-option` `data-*` attributes, the `#plan-summary` table, and the JSON-LD `Offer` nodes.
- The plan-summary table is `.ruled-table.comparison-table`, so it stacks into labelled cards below
  700px. Every `td` needs a `data-label` matching its column header for that to work.
- FAQ schema matches the visible FAQ copy exactly. Keep them in sync or drop the schema.

**GEO**

- `Organization` carries `url`, `logo`, `sameAs`, `description`, `areaServed`, `contactPoint` and
  `knowsAbout`; `SoftwareApplication` carries `applicationSubCategory`, `featureList`, `audience`
  and `inLanguage`. These are entity-identification signals, not ranking tricks.
- `SoftwareApplication.offers` is an `AggregateOffer` containing one `Offer` per plan, each with a
  `UnitPriceSpecification` for monthly and 3-month billing and `valueAddedTaxIncluded: false`
  (prices exclude 18% GST). This lets an engine answer a per-plan price question precisely.
- `/pricing` also carries a `Service` node per managed service (Accountant+, CA+, Auditor).
- `llms.txt` is a short curated index; `llms-full.txt` restates every page and every published Q&A
  in one plain-text document. Both carry a `Last updated` date and name the website as
  authoritative. Regenerate `llms-full.txt` whenever pricing or FAQ copy changes.
- No `BreadcrumbList` is published: the site is three pages deep with no visible breadcrumb trail,
  and `/` permanently redirects, so a breadcrumb would describe navigation that does not exist.

**Rules**

- Do not add ratings, reviews, certifications, customer results or unsupported claims without
  approved evidence. There is no `aggregateRating` in the graph on purpose.
- The competitor comparison table on `/business` (Tally, Zoho, ClearTax, Vyapar, Khatabook) is a
  strong retrieval asset **and** the site's largest factual liability. Date it, source it, and
  re-verify it on a schedule; competitor feature claims age badly and are the first thing a
  competitor will dispute.

## Local preview and launch checks

Serve this folder over HTTP and preview `/business/`, `/ca-firms/` and `/pricing/`. Production rewrites remove the trailing slash.

The `qa/` directory contains verification evidence only. It is not required by the website at runtime and may be excluded from the production deployment bundle.

Before launch, connect the form endpoint, confirm analytics, reconfirm commercial and competitor-comparison claims, run production Lighthouse tests, and verify the following deployed URLs: `/`, `/business`, `/ca-firms`, `/pricing`, `/index.html` and `/pricing.html`.


## What changed from V2

| Area | V2 | V3 |
|---|---|---|
| Business plans | Starter / Growth / Pro, ₹999–₹2,999 | Light / Pro / Pro Max, ₹999–₹2,999 (1 company, no extra members) |
| CA/Firm plans | E5 / E10 / E25 priced by client-company count | Team / Enterprise priced by companies + seats, scaled with add-ons |
| Billing | Monthly / Annual, "12 months for the price of 10" | Monthly / 3 months, 3-month default, save 20% |
| Presentation | Static comparison tables | Interactive plan selector with live figure and GST total |
| GST | Ex-GST prices only | Ex-GST price plus GST-inclusive total on the selected plan |
| Lead form | Single-step placeholder, no endpoint | Three-step flow POSTing to the live Google Apps Script sheet |
| CTAs | "Choose a plan" | Book a demo only — the site never sells a plan directly |
| Managed services | Pricing page only | Pricing page + end of the business page |

## Decisions and open items

1. **No purchase CTAs anywhere.** Every pricing action routes to a demo booking. Plans are chosen
   and paid for inside the product after the trial. Do not add a checkout link without a decision.
2. **"12 months for the price of 10" is retired.** It no longer appears anywhere in the build.
3. **Team members dropped from the business plans.** The Individual tiers are explicitly
   "1 company, just you", so the v2 "2/2/3 team members included" line has been removed. Extra
   seats are now an add-on at ₹299 per member per month.
4. **CA firms above ten client companies have no self-serve tier.** Enterprise caps at ten;
   beyond that the copy routes to a demo so the team can size it. If a published tier for large
   practices is wanted, it needs to be priced first.
5. **The autopay offer was removed.** V2 offered 10% extra usage for setting up autopay during the
   trial. It is not in the August pricing source, and it presumes a payment step the website no
   longer has. Confirm whether it still applies.
6. **The "firms can trial five client companies" claim was removed** — five is not a boundary in
   the new plan structure. Replaced with full access for 14 days.
7. **Derived monthly equivalents** for Pro, Pro Max and Enterprise — see above.
8. **Lead endpoint liveness is unverified.** `LEAD_ENDPOINT` is wired to the new sheet's Apps
   Script deployment, but no test write has been made through it. Submit one real lead on the
   deployed site and confirm a single row lands with both step 1 and step 2 in it.
9. **The header audience toggle still uses pill-shaped controls** (`.route-toggle`, 999px radius),
   which the design brief's rejection checklist disallows. Left as-is because it is v2 chrome
   outside the pricing re-skin; the billing switch itself was squared off to 4px.
