# GeniusCFO Website V5

Start here. This handover contains three product pages and one business story:

| Public URL | Source document | Audience |
|---|---|---|
| `/business` | `business/index.html` | Business owners |
| `/ca-firms` | `ca-firms/index.html` | CA and accounting firms |
| `/pricing` | `pricing/index.html` | Shared pricing for both audiences |
| `/stories/every-invoice-looked-fine` | `stories/every-invoice-looked-fine/index.html` | Business owners; a fictional restaurant story |

These are separate, source-readable HTML documents. The Business and CA/Firm pages are not two states hidden inside one page. The Pricing page is shared and uses `audience=business` or `audience=ca-firms` only to retain audience context.

## Folder map

```text
business/index.html       Business landing page
ca-firms/index.html       CA/Firm landing page
pricing/index.html        Shared Pricing page
assets/site-v4.css        Stylesheet for all three pages (V4 design language)
assets/site.css           V3 stylesheet, no longer linked by any page
assets/site.js            Lead form, Cal.com embed/events, plan selector, UTM preservation, lightbox
assets/site-v4.js         Presentation only: know-more, floating CTA, scroll-fade, word-rise, marquee
assets/screens/           Product captures and the two animated screens used by the pages
assets/fonts/             Self-hosted fonts
apps-script/Code.gs       Google Apps Script receiving the lead form into a sheet
qa/                       Test reports and reference captures; not deployed content
index.html                Fallback redirect only; not a content page
vercel.json               Production routes and headers for Vercel
.vercelignore             Keeps qa/, apps-script/ and the markdown off the site
VERCEL-SETUP.md            Vercel, DNS, lead-sheet, Cal.com and GTM setup
```

## Deployment choice

The host is Vercel. `vercel.json` is the routing file; the Netlify
configuration has been removed. On another host, reproduce the rewrites and
redirects in the supplied configuration.

The configuration permanently redirects `/` and `/index.html` to `/business`. It rewrites the product and story URLs to their physical HTML documents without exposing `index.html` in public URLs.

`VERCEL-SETUP.md` is the step-by-step: creating the project, pointing
`geniuscfo.ai` at it, wiring the lead form to its Google Sheet and Cal.com,
and the post-deploy URL checks.

URL fragments are never sent to the server. Therefore an old root link such as `https://geniuscfo.ai/#for-firms` cannot be distinguished by a permanent server redirect and must be replaced at its source with `https://geniuscfo.ai/ca-firms`. The fallback root `index.html` retains client-side fragment handling only for hosts that do not apply the supplied production redirects.

## Local preview

Serve this folder over HTTP. With a basic static server, preview:

- `/business/`
- `/ca-firms/`
- `/pricing/`
- `/stories/every-invoice-looked-fine/`

The trailing slash is a local static-server detail. Production canonical URLs do not use a trailing slash.

## What is new in V5

- All three pages now run the V4 design language (`assets/site-v4.css`). V4 only ever
  shipped `/business`; `/ca-firms` and `/pricing` have been rebuilt to match.
- New section on `/business` and `/ca-firms`: **Your AI Accounting Suite** — CFO,
  Accountant, GST and Coming soon — directly under the hero.
- The business hero and the Ask GeniusCFO screen are animated. Both ship as a still
  poster and gain their animation only after the page has finished loading visibly;
  clicking either opens it full size and plays it from the start. Sources are built in
  Remotion (see `GCFO Claude Central/geniuscfo-videos`).
- Early alerts is no longer its own section on `/business`; it folds into
  *Review and trust* behind a Know more control.
- Plan cards carry check-marked feature lists on every page.
- Steps 1 and 2 write to the linked lead Sheet and emit diagnostic events only.
  Step 3 is a Cal.com inline embed for `geniuscfo/30min`; Cal's GTM app sends
  `bookingSuccessfulV2`, which the web container maps to GA4 `generate_lead`.
- The consent checkbox is mandatory and reads "WhatsApp and/or email".
- Every product screenshot was recaptured from the current
  `geniuscfo-launch-mockup` build.

## What was new in V3

- Pricing was rebuilt on the plan architecture from `app.geniuscfo.ai/#pricing`: Light / Pro /
  Pro Max for businesses, Team / Enterprise for CA firms, billed monthly or every three months.
  The Monthly/Annual toggle and the E5/E10/E25 tiers are gone.
- The static comparison tables became an interactive plan selector with a live selected-plan
  figure and a GST-inclusive total, re-skinned into the site's ruled/ledger language.
- The placeholder demo form became a live three-step lead form. Steps 1 and 2
  post to the existing Google Apps Script lead Sheet receiver; Step 3 books on
  Cal.com.
- Every pricing CTA books a demo. The website does not sell a plan directly.

`VERCEL-SETUP.md` covers the lead Sheet, Cal.com, GTM and production hosting.
`qa/` holds the rendered evidence for the current build.

## Business story

The story at `/stories/every-invoice-looked-fine` preserves the approved source article and the compositions of both supplied images. It serves responsive AVIF/WebP derivatives, with a compressed JPEG for social sharing; the master PNGs are untouched and are not shipped to the page. It uses the shared `site-v4.css` theme and `site.js` interactions, with only article layout in `assets/story.css`. The new page includes the existing `GTM-NPMFZCZG` loader and noscript fallback. Campaign parameters are preserved on links into the business demo flow. A click is not counted as a lead. The new URL is linked from the Business footer, sitemap, and the existing language-model reference files. No publication date is invented before release.
