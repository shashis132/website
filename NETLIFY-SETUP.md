# Netlify setup

The host choice in `README.md` is now made: this repository is configured for
Netlify. `vercel.json` has been removed, and `_redirects` is the single routing
table, as `DEVELOPER-HANDOFF.md` requires.

## What is in the repository

| File | Purpose |
|---|---|
| `netlify.toml` | Publish directory, build command, security and cache headers |
| `netlify-build.sh` | Stages the deployable site into `dist/` |
| `_redirects` | The three rewrites and three redirects, copied into `dist/` |
| `apps-script/Code.gs` | Google Apps Script that receives the lead form into a sheet |

There is no framework and nothing to compile. The "build" only copies the
publishable files into `dist/`, because Netlify publishes a whole directory and
has no exclude option — this keeps `qa/`, `apps-script/` and the handover
markdown off the public site. Run it locally with `bash netlify-build.sh`.

## 1. Create the site

1. Sign in at <https://app.netlify.com> and choose **Add new site → Import an
   existing project → GitHub**.
2. Authorise Netlify for the `Genius-CFO/website` repository.
3. Pick the branch you want to deploy from.
4. Netlify reads `netlify.toml`, so the build settings are already filled in:
   - Build command: `bash netlify-build.sh`
   - Publish directory: `dist`
5. **Deploy site.**

The first deploy lands on a `random-name.netlify.app` URL. Everything below can
be verified there before any DNS is touched.

## 2. Point `geniuscfo.ai` at it

In **Site configuration → Domain management → Add a domain**, enter
`geniuscfo.ai`. Netlify then gives you one of two paths:

- **Netlify DNS** — change the nameservers at your registrar to the four
  Netlify gives you. Netlify handles the apex record and the certificate.
- **External DNS** — keep your current DNS and add, at the registrar:
  - `geniuscfo.ai` → `A` → `75.2.60.5` (Netlify's load balancer; confirm the
    value Netlify shows you, it is authoritative over this document)
  - `www.geniuscfo.ai` → `CNAME` → your `*.netlify.app` hostname

Set `geniuscfo.ai` as the **primary domain** so `www` redirects to the apex —
every canonical tag, the sitemap and `llms.txt` use the bare apex. HTTPS is
issued automatically once DNS resolves; leave **Force HTTPS** on.

## 3. Wire the lead form to the sheet

The old Apps Script endpoint has been removed from `assets/site.js`. Until a new
one is set, submissions still advance through the form but nothing is written
anywhere, and a warning naming the missing endpoint is logged to the console.

1. Open the Google Sheet the leads should land in → **Extensions → Apps Script**.
2. Replace the contents of `Code.gs` with `apps-script/Code.gs` from this
   repository, and save. (If you already have a script for this sheet, use it
   instead — it only has to accept a form-encoded POST with the fields listed
   below.)
3. **Deploy → New deployment → Web app**, with **Execute as: Me** and **Who has
   access: Anyone**. Authorise it when prompted.
4. Copy the `/exec` URL.
5. Paste it into `LEAD_ENDPOINT` at the top of `assets/site.js`, commit, push.

Redeploying the Apps Script mints a new `/exec` id, so `LEAD_ENDPOINT` has to be
updated whenever you redeploy it.

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
Submit one real lead on the deployed site and confirm the row appears with both
the step 1 and the step 2 values in it.

## 4. Google Tag Manager

`GTM-NPMFZCZG` is installed on all four HTML files — the loader high in `<head>`
and the `<noscript>` iframe immediately after `<body>`. `assets/site.js` pushes
`generate_lead`, `lead_step2_complete`, `pricing_plan_selected` and
`pricing_billing_toggled` onto `dataLayer`; configure the tags for those inside
GTM. Confirm with GTM Preview against the deployed URL, not locally.

## 5. Check the deployed site

Against the Netlify URL, and again after DNS moves:

| Request | Expected |
|---|---|
| `/` | 308 → `/business` |
| `/index.html` | 308 → `/business` |
| `/business` | 200, the business page, no trailing slash |
| `/ca-firms` | 200, the CA/firm page |
| `/pricing` | 200, the pricing page |
| `/pricing.html` | 301 → `/pricing` |
| `/pricing?audience=business#business-plans` | 200, query string preserved |
| `/qa/lighthouse-v3-business.json` | 404 — QA evidence must not be public |

```sh
for p in / /index.html /business /ca-firms /pricing /pricing.html; do
  curl -s -o /dev/null -w "%{http_code} %{redirect_url}  $p\n" "https://YOUR-SITE.netlify.app$p"
done
```

The rules in `_redirects` carry a `!` suffix. Netlify skips an unforced rule
whenever a real file exists at that path, which would leave the root
`index.html` fallback page being served at `/` instead of redirecting to
`/business`. Do not drop the `!` from the root rules.

## Still outstanding before launch

These come from `DEVELOPER-HANDOFF.md` and `QA-SUMMARY.md` and are not resolved
by this setup:

- Confirm the derived monthly equivalents for Pro, Pro Max and Enterprise.
- Re-verify the answer-engine crawler tokens in `robots.txt`.
- Re-verify the competitor comparison table on `/business`.
- Run Lighthouse against the deployed site.
- Consider a Content-Security-Policy. `netlify.toml` deliberately sets none:
  the pages carry inline JSON-LD and an inline GTM loader, and post to
  `script.google.com`, so a policy has to be authored against those and tested
  rather than guessed.
