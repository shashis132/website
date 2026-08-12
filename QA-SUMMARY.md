# GeniusCFO Website V3 — QA summary

V2 baseline verified 5 August 2026. V3 changes verified 11 August 2026.
**Browser render pass and fixes: 11 August 2026 (V3.1).**
**SEO / AEO / GEO pass: 11 August 2026 (V3.2).**

**Read this first.** V3 replaced the pricing architecture and the lead form. The V3.1 pass
rendered all three pages in real Chromium at 360 / 768 / 1440, ran axe-core and Lighthouse,
drove the plan selector and the lead form end to end, and fixed everything it found. See
"V3.1 — browser render pass" and "V3.2 — SEO / AEO / GEO pass" below for the defect lists, and
"Still to verify" for what genuinely cannot be checked without production access.

---

## What V3 changed

- Business plans: Starter / Growth / Pro → **Light / Pro / Pro Max** (Individual tiers).
- CA/Firm plans: E5 / E10 / E25 → **Team / Enterprise**, priced by companies and seats.
- Billing: Monthly / Annual → **Monthly / 3 months**, 3 months default, save 20%.
- Comparison tables → **interactive plan selector** with a live selected-plan figure and GST total.
- Placeholder demo form → **three-step lead form** POSTing to the live Google Apps Script sheet.
- All purchase-style CTAs → **Book a demo only**.
- Managed services added to the end of `business/index.html`.

---

## Verified for V3

**Structure**

- All four HTML documents parse with zero unclosed or mismatched tags.
- Root `index.html` remains a redirect fallback, not a content page.
- `assets/site.js` and `assets/site.css` cache-bust to `v=20260811-2` on every page (bumped from `-1` by the V3.1 fixes).

**Pricing data — checked against source, not by eye**

- Every one of the 10 plan/period combinations across the three pages was compared field by field
  against `August Pricing Page Reference/pricing-page-reference/pricing-content.json`
  (captured 11 August 2026). All display prices and GST totals match exactly.
- All 10 GST totals were independently recomputed at 18% and matched the source to the rupee.
- No `₹9,990`, `₹19,990`, `₹29,990`, `₹49,990`, `₹99,990` or other annual figure survives anywhere.

**Plan selector — exercised in a headless DOM (jsdom), 15 assertions, all passing**

- Both selectors initialise to the 3-month period with the first plan selected.
- The figure shows the monthly equivalent on 3-month billing and the flat price on monthly.
- Switching the period updates the figure, the GST total, every option's price and the CTA query.
- Selecting a different plan moves the `is-selected` state and updates the figure and total.
- The two selectors on the pricing page hold independent state.
- The CTA gains `?plan=…&billing=…` and the selection reaches the lead form's `interested_plan`.

**Lead form — exercised in a headless DOM (jsdom), 37 assertions, all passing**

- Starts on step 1; steps 2 and 3 are hidden.
- Empty submit is blocked, per-field errors appear, and nothing is POSTed.
- A mobile number not starting 6–9 is rejected; a malformed email is rejected.
- A valid step 1 advances to step 2 and POSTs once, to the Apps Script URL.
- Payload carries name, phone, company, role, track, turnover, consent, `interested_plan`,
  landing audience/path and UTMs.
- Role chips switch the branch: choosing a CA/vCFO firm hides annual turnover and swaps the triage
  questions to client tool and client count.
- `/ca-firms` presets `track=practice` and the firm branch; turnover posts blank.
- Step 2 POSTs a second time with `step=2`, the triage answers and the same phone number.
- `dataLayer` receives `generate_lead` on step 1.

**Copy sweep — zero occurrences remain of**

annual billing · "12 months for the price of 10" · Starter · Growth · E5 · E10 · E25 ·
queue · batch · autopay · "Continue to payment" · the v2 `data-billing-value` markup ·
the v2 `demo-form` markup.

*(The words "annual" and "Annual turnover" survive only in an image alt-text and the lead form's
turnover label, both correct.)*

---

## V3.1 — browser render pass, 11 August 2026

Rendered in headless Chromium 131 over a local static server reproducing the production
rewrites (`/business`, `/ca-firms`, `/pricing`). Viewports 360, 768 and 1440. Assets bumped to
`v=20260811-2`.

### Defects found and fixed

1. **Plan selector overflowed and was clipped below ~400px — serious.** `.plan-option-price`
   set `white-space: nowrap`, which the price note (`EVERY 3 MONTHS · EX-GST · SAVE 20%`)
   inherited. That made each option unbreakable at ~374px, and because `.plan-selector` used an
   implicit `auto` grid column it sized to that min-content instead of the 320px available.
   `section.chapter { overflow-x: clip }` then cut the copy off: the CA/Firm figure line, the
   "SAVE 20%" note and the "Running more than ten client companies?" CTA note were all truncated
   mid-sentence at 360px. Fixed with `grid-template-columns: minmax(0, 1fr)`, `min-width: 0` on
   the selector's children, and `white-space: normal` on the note.
2. **`.pricing-support` was light-on-light on `/business` — serious contrast failure.** The
   paper-surface override was scoped `.pricing-page .on-paper`, and `business/index.html` is not
   `.pricing-page`, so the managed-services note rendered near-invisible. Scope widened to
   `.on-paper`.
3. **`?plan=` / `?billing=` were generated but never consumed.** A visitor who picked Pro Max on
   `/pricing` and clicked through landed on `/business` with the selector reset to Light /
   3 months, and the sheet received `interested_plan=business:light/quarterly` — the wrong plan
   on every deep-linked lead. `site.js` now reads both params back and preselects.
4. **Unhandled promise rejection on every lead POST.** `window.fetch(...)` was wrapped in
   `try/catch`, which cannot catch an async rejection. A blocked or offline beacon surfaced as an
   uncaught `Failed to fetch` page error. A `.catch()` was added.
5. **Form errors were not announced and fields were not marked invalid.** Error nodes now carry
   `role="alert"`, invalid fields get `aria-invalid="true"` and an `aria-describedby` link to
   their message, and submit moves focus to the first invalid field instead of only scrolling.
6. **Price changes were a silent visual update.** `.plan-figure` now carries
   `aria-live="polite"` / `aria-atomic`, so toggling billing or changing plan is announced.
7. **The add-ons table scrolls sideways at 390px but was not keyboard reachable** (axe:
   `scrollable-region-focusable`). `site.js` adds `tabindex="0"`, `role="region"` and a label —
   only while the content actually overflows.
8. **Consent checkbox was 20×20**, under the 24px WCAG 2.2 SC 2.5.8 minimum. Now 24×24. Footer
   links were given vertical padding for the same reason.
9. **Access-strip copy sat outside any landmark** (axe: `region`). The strip is now
   `role="region"` with a label.
10. **CA/Firm screenshots were PNG-only** while the Business page served WebP through
    `<picture>`. Six WebP variants generated (37–50% smaller) and the CA/Firm images wrapped in
    `<picture>`. The Business hero image gained `fetchpriority="high"`.
11. **Dead V2 CSS removed** (`[data-billing-value] small`, `.tier .price-annual`).

### Now verified in a real browser

- **Zero axe-core violations** on `/business`, `/ca-firms` and `/pricing` at 1280, and on
  `/pricing` at 390.
- **No horizontal overflow or clipped copy** in any plan selector at 360, 768 or 1440.
- **Plan selector**: defaults, independent business/firm state, billing toggle, live figure and
  GST total, CTA query string, UTM pass-through, and deep-link preselection all exercised.
- **Lead form**: empty submit blocked with four errors and no POST; valid step 1 POSTs exactly
  once with name, phone and `interested_plan`; step 2 POSTs with `step=2`; step 3 confirmation
  renders; focus lands on each step's heading; the CA-firm role branch hides annual turnover.
- **Skip link** measured at `top: -55px` when unfocused — correctly hidden. (It appears in
  element-level screenshots only as a Playwright artifact of `position: fixed`.)
- **`qa/` screenshots regenerated.** The misleading `*-annual-390.png` captures are deleted;
  the folder now holds 3-month pricing captures at 390, full-page captures at 1440 and the lead
  form at 390.

### Lighthouse — re-measured 11 August 2026, local server

| Page | Performance | Accessibility | Best Practices | SEO |
|---|---:|---:|---:|---:|
| Business | 89 | 100 | 100 | 100 |
| CA/Firm | 86 | 100 | 100 | 100 |
| Pricing | 96 | 100 | 100 | 100 |

Mobile emulation, Chromium 131, against `localhost` with **no gzip or brotli**. Lighthouse's
top opportunity on both landing pages is "Enable text compression" (~80KB) and the
render-blocking cost that follows from it — both disappear on Vercel/Netlify, which compress by
default. CLS is 0 and TBT is 40ms / 190ms. Treat these as a floor and re-run on the deployed
domain before signing off.

---

## V3.2 — SEO / AEO / GEO pass, 11 August 2026

Applied with the `saas-seo-geo-aeo` framework. Assets remain at `v=20260811-2`; no JS or layout
behaviour changed except the new pricing section and one mobile table rule.

### Defects found and fixed

1. **The CA/Firm `AggregateOffer` still carried V2 prices — serious.** It declared
   `lowPrice 2999 / highPrice 9999 / offerCount 3`, which are the retired E5/E10/E25 figures. The
   visible page says Team ₹3,999 and Enterprise ₹6,999. Structured data that contradicts visible
   content is a guidelines violation and feeds wrong prices to answer engines. Corrected to
   `3999 / 6999 / 2`.
2. **Monthly plan prices did not exist as crawlable text anywhere on `/pricing`.** The selector
   renders the 3-month figures and holds the monthly ones in `data-*` attributes, which are not
   text. A no-JS extraction of `/pricing` returned ₹2,398 / ₹4,798 / ₹7,198 and no ₹1,999,
   ₹3,999 or ₹6,999 — while ₹2,999 and ₹4,999 *were* present as managed-service prices, so an
   engine could plausibly have answered "GeniusCFO costs ₹2,999/month" citing the CA+ service.
   Added `/pricing#plan-summary`: an answer-first section headed "What does GeniusCFO cost per
   month?" with a 48-word answer and a full five-plan table. The business and CA/Firm plan notes
   now also state their monthly prices in prose.

### Improvements

3. **Entity graph enriched for retrieval.** `Organization` gained `description`, `areaServed`,
   `contactPoint` and `knowsAbout`; `SoftwareApplication` gained `applicationSubCategory`,
   `featureList`, `audience` and `inLanguage`; `WebPage` gained `dateModified` and
   `isAccessibleForFree`.
4. **Per-plan `Offer` nodes added** inside each `AggregateOffer`, with a `UnitPriceSpecification`
   for monthly and 3-month billing and `valueAddedTaxIncluded: false`.
5. **`Service` nodes added** on `/pricing` for Accountant+, CA+ and the Independent Statutory &
   Tax Auditor.
6. **`robots.txt` rewritten** to name search and answer-engine crawlers explicitly
   (Googlebot, Bingbot, Google-Extended, GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot,
   Claude-User, Claude-SearchBot, PerplexityBot, Perplexity-User, Applebot, Applebot-Extended,
   Bytespider, Amazonbot, meta-externalagent, cohere-ai), all Allow, plus pointers to both llms
   files. **The tokens need re-verifying against vendor documentation before launch.**
7. **`sitemap.xml`** gained `lastmod`, `changefreq` and `priority`.
8. **`llms-full.txt` created** (9.6KB): every page, the full price matrix, all 23 published
   questions and answers, and a glossary of GST/TDS/ITR/Schedule III terms. Generated from the
   pages' own FAQ schema, so it cannot drift on creation. `llms.txt` now carries a
   `Last updated` date, a contact, and a pointer to the full file.
9. **Mobile table stacking fixed.** `.ruled-table` sets `min-width: 720px`, which overrode the
   `.comparison-table` card stacking on the new combined-class table; `caption` also stayed
   `display: table-caption` and collapsed into a ~60px column. Both corrected inside the existing
   `max-width: 699px` block, which also fixes the caption on the existing `/business` table.

### Verified

- **19 assertions passing**: every plan price (₹999 / ₹1,999 / ₹2,999 / ₹3,999 / ₹6,999 and all
  3-month and GST-inclusive figures) is present in a **JavaScript-disabled** render of the
  relevant page; every `Offer` price in the JSON-LD appears in visible text; every `FAQPage`
  question appears as visible copy; the answer block is 48 words; no overflow at 360px.
- All JSON-LD parses, one `@graph` per page, no duplicate or orphaned nodes.
- **Zero axe-core violations** and **SEO 100** on all three pages after the changes. The full V3.1
  behaviour suite still passes.

### Not done, deliberately

- No `aggregateRating`, review, or award markup — there is no approved evidence for any of it.
- No `BreadcrumbList` — no visible breadcrumb trail exists and `/` permanently redirects.
- No competitor comparison pages. The existing `/business` comparison table is unsourced and
  undated; it needs verification before it is expanded, not after.

---

## Still to verify — needs production access

1. **Submit a real lead end to end** and confirm both the step 1 and step 2 rows reach the sheet.
   The POST uses `mode:"no-cors"`, so a failure is silent by design — the fix in item 4 above
   stops it throwing, it does not make failure visible.
2. **Confirm the Apps Script deployment id** in `LEAD_ENDPOINT` is still current. A redeploy
   changes it, and the form will fail silently against a stale id.
3. **Screen-reader pass** with an actual AT (NVDA/VoiceOver). The ARIA above is correct by
   inspection and axe is clean, but no assistive technology has read these pages aloud.
4. **Re-run Lighthouse on the deployed domain** with compression and CDN caching in play.
5. **Verify the production redirects** (`/`, `/index.html`, `/pricing.html`) on the host.
6. **Validate the JSON-LD** with Google's Rich Results test. The graphs parse and the visible
   FAQs match, but no structured-data validator has been run.
7. **Reconfirm the derived monthly equivalents** for Pro (₹1,599), Pro Max (₹2,399) and
   Enterprise (₹5,599) — computed, not supplied by the source. All ten plan/period prices and
   all ten GST totals were independently recomputed at 18% and match to the rupee.
8. **Reconfirm the removed claims**: the autopay offer and the "five client companies on trial"
   line were both dropped. See `DEVELOPER-HANDOFF.md`.
9. **Optional performance work**: minify `site.css` / `site.js` at build time (~15KB) and add
   `srcset`/`sizes` to the product screenshots (~260KB on mobile). Neither is a defect.

---

## Inherited from V2 — unchanged areas, still believed good

- Product-image lightbox: full-image link fallback, Escape to close, focus restored to trigger.
- Ask GeniusCFO example switcher.
- Audience links preserving UTM and click identifiers.
- Root fallback routing legacy `#for-business` and `#for-firms` fragments.
- One H1 per page; one valid JSON-LD graph per page; visible FAQs matching FAQ schema.
- All referenced local stylesheets, scripts, images, SVGs and fonts exist.

FAQ schema and visible FAQ copy were both updated together on all three pages for V3 and still
match, but this was checked by reading, not by a structured-data validator. Run one.

---

## Mobile Lighthouse results — V2 baseline, for comparison only

| Page | Performance | Accessibility | Best Practices | SEO |
|---|---:|---:|---:|---:|
| Business | 98 | 100 | 100 | 100 |
| CA/Firm | 95 | 100 | 100 | 100 |
| Pricing | 96 | 100 | 100 | 100 |

Measured 5 August 2026 against the V2 build **on the deployed, compressed domain**. The V3.1
scores above are lower because they were measured against an uncompressed local server, not
because the build regressed. `qa/lighthouse-v3-*.json` now hold the V3.1 reports.

---

## Launch queue

- Work through "Still to verify" above.
- Confirm the lead sheet is receiving both POSTs.
- Configure production analytics for `generate_lead`, `lead_step2_complete`,
  `pricing_plan_selected` and `pricing_billing_toggled`.
- Sign off prices, managed-service claims and the CA/Firm scaling narrative before publishing.
- Verify redirects and repeat Lighthouse on the deployed domain.
