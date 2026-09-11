# GeniusCFO Website V5

Start here. This handover contains three product pages, two section indexes, two business stories, one blog article and the privacy policy:

| Public URL | Source document | Audience |
|---|---|---|
| `/business` | `business/index.html` | Business owners |
| `/ca-firms` | `ca-firms/index.html` | CA and accounting firms |
| `/pricing` | `pricing/index.html` | Shared pricing for both audiences |
| `/stories` | `stories/index.html` | Index of the fictional business stories |
| `/stories/every-invoice-looked-fine` | `stories/every-invoice-looked-fine/index.html` | Business owners; a fictional restaurant story |
| `/stories/the-second-job` | `stories/the-second-job/index.html` | Business owners; a fictional garment-unit story |
| `/blog` | `blog/index.html` | Index of the analysis articles |
| `/blog/through-the-glass` | `blog/through-the-glass/index.html` | Business owners and buyers; analysis, not fiction |
| `/privacy` | `privacy/index.html` | Everyone; linked from the footer of every page |

These are separate, source-readable HTML documents. The Business and CA/Firm pages are not two states hidden inside one page. The Pricing page is shared and uses `audience=business` or `audience=ca-firms` only to retain audience context.

## Folder map

```text
business/index.html       Business landing page
ca-firms/index.html       CA/Firm landing page
pricing/index.html        Shared Pricing page
privacy/index.html        Privacy policy, linked from every footer
stories/index.html        Stories index; the only page that lists the stories
stories/<slug>/index.html A fictional business story
blog/index.html           Blog index; the only page that lists the articles
blog/<slug>/index.html    An analysis article
assets/site-v4.css        Stylesheet for all three pages (V4 design language)
assets/story.css          Article and index layout for stories and blog, layered over site-v4.css
assets/legal.css          Article layout for the privacy policy, layered over site-v4.css
assets/site.css           V3 stylesheet, no longer linked by any page
assets/site.js            Lead form, Cal.com embed/events, plan selector, UTM preservation, lightbox
assets/site-v4.js         Presentation only: know-more, floating CTA, scroll-fade, word-rise, marquee
assets/screens/           Product captures and the two animated screens used by the pages
assets/fonts/             Self-hosted fonts
assets/stories/<slug>/v1/ Story artwork derivatives (AVIF/WebP + social JPEG)
assets/blog/<slug>/v1/    Blog artwork derivatives, same shape
tools/build-story-images.py  Rebuilds those derivatives from uncommitted masters
apps-script/Code.gs       Google Apps Script receiving the lead form into a sheet
qa/                       Test reports and reference captures; not deployed content
index.html                Fallback redirect only; not a content page
vercel.json               Production routes and headers for Vercel
.vercelignore             Keeps qa/, apps-script/, artwork masters and the markdown off the site
VERCEL-SETUP.md            Vercel, DNS, lead-sheet, Cal.com and GTM setup
```

## Deployment choice

The host is Vercel. `vercel.json` is the routing file; the Netlify
configuration has been removed. On another host, reproduce the rewrites and
redirects in the supplied configuration.

The configuration permanently redirects `/` and `/index.html` to `/business`. It rewrites the product, index, story and blog URLs to their physical HTML documents without exposing `index.html` in public URLs.

`/insights/through-the-glass` also redirects permanently to `/blog/through-the-glass`. The article's source file carried that canonical before the blog existed; the redirect exists so the URL is not dead if it was ever shared.

`VERCEL-SETUP.md` is the step-by-step: creating the project, pointing
`geniuscfo.ai` at it, wiring the lead form to its Google Sheet and Cal.com,
and the post-deploy URL checks.

URL fragments are never sent to the server. Therefore an old root link such as `https://geniuscfo.ai/#for-firms` cannot be distinguished by a permanent server redirect and must be replaced at its source with `https://geniuscfo.ai/ca-firms`. The fallback root `index.html` retains client-side fragment handling only for hosts that do not apply the supplied production redirects.

## Local preview

Serve this folder over HTTP. With a basic static server, preview:

- `/business/`
- `/ca-firms/`
- `/pricing/`
- `/stories/`
- `/stories/every-invoice-looked-fine/`
- `/stories/the-second-job/`
- `/blog/`
- `/blog/through-the-glass/`
- `/privacy/`

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
  The server container turns that one event into the Meta `Lead` and the
  LinkedIn Conversions API lead, deduplicated against the browser tags by
  event id. The embed URL carries SHA-256 hashes of the Step 1 email, phone
  and name plus the Meta, LinkedIn and GA4 ids from geniuscfo.ai, so the
  third-party booking frame can attribute the booking; nothing personal is
  sent in clear text.
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

## Stories and blog

### The two deferred decisions, now settled

Both choices flagged at the second story have been taken, at the third
piece rather than the fifth.

1. **The footer pattern was replaced, not extended.** Per-story lines are
   gone. Every page's Business footer column now carries two section
   links, `Stories` and `Blog`, and the primary navigation carries the
   same two. Adding a story or an article is now an edit to one index
   page, not an edit to every page in the site. The desktop navigation
   went from four items to six; `site-v4.css` steps the gap and size down
   between 1024px and 1200px so the row still does not wrap.
2. **Owner stories stay reachable from `/ca-firms`.** The question was
   whether owner-register narrative belongs on a page written for firms,
   whose villain is the drag rather than the lag. It is now a single
   neutral `Stories` link in a footer column already labelled Business,
   rather than two owner-voice headlines, so the objection that motivated
   the question no longer applies. Revisit if the firm audience ever gets
   its own stories.

**`datePublished`.** The convention was to omit it rather than invent one
before release. `/blog/through-the-glass` went live on 11 September 2026
and carries a real `datePublished` and `dateModified`. Both stories are
still undated, which is correct — do not backfill a date neither of them
had.

### Content types

The two sections are deliberately different and should stay so.

- **`/stories`** is fiction. Each story carries a closing disclosure that
  the people and every financial figure are invented, and the schema
  marks it `"genre": "Fiction"`. It is `articleSection: Business stories`.
- **`/blog`** is analysis, with named third parties, cited sources and
  modelled figures. It is `articleSection: Analysis`, carries a
  `citation` array in its `Article` node, and its closing disclosure says
  the cost figures are modelled from published list prices under stated
  assumptions rather than a bill anyone received. Nothing in it is
  fiction, so it carries no `genre`.

Keep an analysis piece out of `/stories` and a fictional narrative out of
`/blog`; the disclosures and the schema are not interchangeable.

### Adding the next piece

1. Write `<section>/<slug>/index.html` from the nearest existing sibling.
2. Add a row to `<section>/index.html`, and bump `numberOfItems` plus the
   `itemListElement` array in that page's `ItemList` node. The visible
   count above the list (`One article`, `Two stories`) is written out in
   words — update it too.
3. Add the rewrite and the two redirects (trailing slash, `index.html`)
   to `vercel.json`, and the URL to `sitemap.xml`.
4. Add it to `llms.txt` and, in full, to `llms-full.txt`. Bump the
   `Last updated` line in both.
5. For artwork, add a `PLAN` entry to `tools/build-story-images.py`; set
   `SECTION` if the slug is not under `assets/stories/`.

No footer or navigation edit is required. That was the point.


Story and blog artwork is shipped as derivatives only. The master illustrations stay with the campaign art and are not committed; `assets/<section>/<slug>/masters/README.txt` records which master belongs to which position, and `tools/build-story-images.py <slug>` regenerates every AVIF/WebP derivative and the social JPEG from them. The `SECTION` map in that script decides whether a slug's artwork lives under `assets/stories/` or `assets/blog/`.

### Outstanding: artwork for /blog/through-the-glass

The article shipped without its three masters, which had not reached the
repository at publication. The page renders correctly as it stands — its
two-architecture diagram is inline SVG and needs no file — but two raster
positions are commented out in `blog/through-the-glass/index.html`, each
marked `ARTWORK SLOT`, and `og:image` points at the site default
`/assets/og-geniuscfo.png` rather than the campaign share card.

`assets/blog/through-the-glass/masters/README.txt` lists the three
masters by prefix and gives the exact restore steps: drop the files in,
run `python3 tools/build-story-images.py through-the-glass`, uncomment
the two figures, repoint the four social-image tags, and add an
`ImageObject` to the JSON-LD `@graph` as the story pages do.

The story at `/stories/every-invoice-looked-fine` preserves the approved source article and the compositions of both supplied images. It serves responsive AVIF/WebP derivatives, with a compressed JPEG for social sharing; the master PNGs are untouched and are not shipped to the page. It uses the shared `site-v4.css` theme and `site.js` interactions, with only article layout in `assets/story.css`. The new page includes the existing `GTM-NPMFZCZG` loader and noscript fallback. Campaign parameters are preserved on links into the business demo flow. A click is not counted as a lead. The new URL is linked from the Business footer, sitemap, and the existing language-model reference files. No publication date is invented before release.
