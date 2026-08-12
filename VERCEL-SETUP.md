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
| `apps-script/Code.gs` | Google Apps Script that receives the lead form into a sheet |

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

## 3. The lead form and its sheet

`LEAD_ENDPOINT` in `assets/site.js` is set to the deployed Apps Script web app.
Redeploying that script mints a new `/exec` id, so the constant has to be
updated whenever you redeploy it.

### Where the rows land

`apps-script/Code.gs` does not create a spreadsheet. It writes to the
spreadsheet the script project belongs to, into a tab called **Leads** that is
created on the first submission — so there is nothing to look for until a lead
has actually been submitted.

- **Script created from inside a sheet** (Extensions → Apps Script): that sheet
  is the destination. Its name is shown at the top of the Apps Script editor,
  and **Overview → Project details** links back to it.
- **Standalone script** (created at script.google.com): there is no attached
  sheet and the script will error. Create the spreadsheet, copy the id out of
  its URL — `docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit` — paste it
  into `SPREADSHEET_ID` at the top of `Code.gs`, and redeploy.

Either way, running **`showSheetUrl`** from the Apps Script editor logs the name
and URL of the spreadsheet the script is actually writing to. Use it to settle
the question rather than guessing.

### If you need to redeploy the script

1. Open the target Google Sheet → **Extensions → Apps Script**.
2. Replace the contents of `Code.gs` with `apps-script/Code.gs` from this
   repository, and save.
3. **Deploy → New deployment → Web app**, with **Execute as: Me** and **Who has
   access: Anyone**. Authorise it when prompted.
4. Copy the `/exec` URL into `LEAD_ENDPOINT` at the top of `assets/site.js`,
   commit, push.

**Two posts per lead.** Step 1 (contact) appends a row. Step 2 (triage) posts
again with the same phone number, and the supplied script finds that row and
fills in the triage answers instead of writing a second row. A script that only
appends will give you two rows per lead.

**Fields posted:** `name`, `phone`, `email`, `company`, `turnover`, `role`,
`track`, `whatsapp_optin`, `whatsapp_consent_source`,
`whatsapp_consent_timestamp`, `interested_plan`, `landing_audience`,
`landing_path`, `page`, `referrer`, `timestamp`, `step`, `challenge`,
`accounting_tool`, `client_accounting_tool`, `client_count`, plus `utm_source`,
`utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`, `fbclid`,
`msclkid`.

**Verifying is not optional.** The POST uses `mode:"no-cors"`, so the browser
never sees whether the write succeeded and the site cannot tell you it failed.
Submit one real lead on the deployed site and confirm a single row appears in
the **Leads** tab with both the step 1 and the step 2 values in it. If the write
fails, the reason is in the Apps Script project's **Executions** log — that is
the only place it surfaces.

## 4. Google Tag Manager

`GTM-NPMFZCZG` is installed on all four HTML files — the loader high in `<head>`
and the `<noscript>` iframe immediately after `<body>`. `assets/site.js` pushes
`generate_lead`, `lead_step2_complete`, `pricing_plan_selected` and
`pricing_billing_toggled` onto `dataLayer`; configure the tags for those inside
GTM. Confirm with GTM Preview against the deployed URL, not locally.

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
