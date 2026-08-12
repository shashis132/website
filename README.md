# GeniusCFO Website V3

Start here. This handover contains exactly three public website pages:

| Public URL | Source document | Audience |
|---|---|---|
| `/business` | `business/index.html` | Business owners |
| `/ca-firms` | `ca-firms/index.html` | CA and accounting firms |
| `/pricing` | `pricing/index.html` | Shared pricing for both audiences |

These are separate, source-readable HTML documents. The Business and CA/Firm pages are not two states hidden inside one page. The Pricing page is shared and uses `audience=business` or `audience=ca-firms` only to retain audience context.

## Folder map

```text
business/index.html       Business landing page
ca-firms/index.html       CA/Firm landing page
pricing/index.html        Shared Pricing page
assets/site.css           Shared styles and responsive components
assets/site.js            Shared interactions, tracking, plan selector and lead form
assets/screens/           Product captures used by the pages
assets/fonts/             Self-hosted fonts
apps-script/Code.gs       Google Apps Script receiving the lead form into a sheet
qa/                       Test reports and reference captures; not deployed content
index.html                Fallback redirect only; not a content page
_redirects                Production routes for Netlify/Cloudflare Pages
netlify.toml              Netlify publish directory and headers
netlify-build.sh          Stages the deployable files into dist/
NETLIFY-SETUP.md           Netlify, DNS, lead-sheet and GTM setup
DEVELOPER-HANDOFF.md       Implementation and integration details
QA-SUMMARY.md              Verification record
```

## Deployment choice

The host is Netlify. `_redirects` is the routing table; `vercel.json` has been
removed. On another host, reproduce the same three rewrites and three redirects.

The configuration permanently redirects `/` and `/index.html` to `/business`. It rewrites the three public URLs to their physical HTML documents without exposing `index.html` in public URLs.

`NETLIFY-SETUP.md` is the step-by-step: creating the site, pointing
`geniuscfo.ai` at it, wiring the lead form to its Google Sheet, and the
post-deploy URL checks.

URL fragments are never sent to the server. Therefore an old root link such as `https://geniuscfo.ai/#for-firms` cannot be distinguished by a permanent server redirect and must be replaced at its source with `https://geniuscfo.ai/ca-firms`. The fallback root `index.html` retains client-side fragment handling only for hosts that do not apply the supplied production redirects.

## Local preview

Serve this folder over HTTP. With a basic static server, preview:

- `/business/`
- `/ca-firms/`
- `/pricing/`

The trailing slash is a local static-server detail. Production canonical URLs do not use a trailing slash.

## What is new in V3

- Pricing was rebuilt on the plan architecture from `app.geniuscfo.ai/#pricing`: Light / Pro /
  Pro Max for businesses, Team / Enterprise for CA firms, billed monthly or every three months.
  The Monthly/Annual toggle and the E5/E10/E25 tiers are gone.
- The static comparison tables became an interactive plan selector with a live selected-plan
  figure and a GST-inclusive total, re-skinned into the site's ruled/ledger language.
- The placeholder demo form became a live three-step lead form posting to the same Google Apps
  Script sheet the current geniuscfo.ai landing page uses.
- Every pricing CTA books a demo. The website does not sell a plan directly.

Read `DEVELOPER-HANDOFF.md` before connecting forms, analytics or production hosting, and
`QA-SUMMARY.md` for what has and has not been verified — the browser-rendered, responsive and
Lighthouse checks still need to be run.
