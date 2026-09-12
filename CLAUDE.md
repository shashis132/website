# Working notes for Claude on this repository

Conventions and hard-won gotchas. `README.md` is the human handover; this
file is the operating memory. `.vercelignore` excludes `*.md`, so neither
is ever published.

## The person you are working with does not write code

Shashi is not a developer and does not use git or GitHub from a terminal.
Consequences for how you work:

- Never hand back a task as a set of commands for them to run. Do the work,
  commit it, push it, and describe the outcome in plain language.
- When something genuinely requires their hands (see artwork below), write
  click-by-click instructions naming the exact page, button and filename.
  Do not say "commit the files" — say which link to open and what to drag.
- Explain *why* in one line, not a paragraph. Skip terminology where a
  plain word exists.

## Getting images and binary files into this repo

**Images attached to a chat message do not reach the container.** They
render in the conversation and you can see them, but no file is written to
disk. This has been confirmed repeatedly. `/root/.claude/uploads/` receives
text files such as `.html` but not the image attachments alongside them.
Do not promise to "use the attached images" and do not burn turns asking
for them again — the attachment path does not deliver them.

**Use the GitHub web upload route.** It is the only one that has worked.

1. Create the destination folder in the repo, committed and pushed, so it
   exists for them to navigate to. A `README.txt` inside it is enough to
   make git keep it, and doubles as the record of what belongs there.
2. Give them the direct `github.com/<owner>/<repo>/tree/<branch>/<path>`
   link, the exact filenames to rename to, and the Add file → Upload files
   click path.
3. When they confirm, `git pull`, then build and wire the assets.

Do not suggest hosting the files somewhere and fetching by URL. The
environment's network policy denies outbound HTTPS to `geniuscfo.ai`, and
a general file host is an extra account they do not need.

Build artwork derivatives with `python3 tools/build-story-images.py <slug>`.
`SECTION` in that script decides whether a slug's artwork lives under
`assets/stories/` or `assets/blog/`.

**Masters uploaded through GitHub stay in the repo.** The older stories'
masters were deleted after building, on the reasoning that they lived with
the campaign art anyway. That does not hold for anything arriving by the
upload route: the repo *is* the delivery mechanism, and deleting them means
the next rebuild costs Shashi another upload round-trip. `.vercelignore`
already keeps `masters/` off the deployment, so they are never served.
A couple of megabytes is cheaper than that round-trip. Keep them.

### Banner masters do not have to match the declared ratio

`.story-banner img` enforces `aspect-ratio` (4:5, or 3:2 with
`--wide`) and now also sets `object-fit: cover`, so an off-ratio master
crops rather than stretches. Before that fix a master that was not exactly
4:5 or 3:2 was silently squashed; both original story masters happened to
match, so it never showed.

## Absolute URLs use the bare apex

`https://geniuscfo.ai`, never `https://www.geniuscfo.ai`. This covers
canonical tags, `og:url`, `sitemap.xml`, `llms.txt`, `llms-full.txt` and
every `@id`, `url` and `item` in the JSON-LD. `VERCEL-SETUP.md` sets the
apex as the primary domain and redirects `www` to it, so a `www` absolute
URL is a canonical pointing at a redirect and a `www` sitemap entry is
excluded from indexing as "Page with redirect".

The stories shipped on `www` and drifted; the site was normalised on
11 September 2026. The worst of it was the schema: the shared
`https://geniuscfo.ai/#organization` node carried `url` set to the apex on
the product pages and to `www` on the stories, so one `@id` had two
conflicting definitions. Check this after adding any page:

```
grep -rn "www\.geniuscfo\.ai" --include=*.html --include=*.txt --include=*.xml .
```

Expect no matches.

## Sections are indexed, not linked page by page

`/stories` and `/blog` are the only pages that list their contents. Every
page's footer and navigation carries two links, `Stories` and `Blog`, and
nothing else per-piece. Adding a story or an article must not touch any
other page — if a change asks you to edit five footers, the index is the
thing to edit instead. `README.md` under "Adding the next piece" has the
five-step checklist.

`/stories` is fiction, carries a dramatised-scenario disclosure and
`"genre": "Fiction"`. `/blog` is analysis with named third parties, a
`citation` array and a modelled-figures disclosure. Keep them apart; the
disclosures and the schema are not interchangeable.

## Verifying before you push

There is no test suite. Serve the folder and check the real thing:

```
python3 -m http.server 8099          # then browse /blog/ /stories/ etc.
```

Chromium is at `/opt/pw-browsers/chromium` and Playwright is installed in
the scratchpad. Worth checking every time: JSON-LD parses on every page,
canonical equals `og:url` equals the sitemap entry, FAQ schema answers
match the visible text verbatim, one `<h1>` per page, no console errors,
and no horizontal overflow at 390px. Screenshot anything visual and look
at it — the emerald total in the cost panel and a cropped story thumbnail
were both caught that way and neither would have shown up in markup.

## Branch and deployment

Work on the branch named in the session prompt and push there. Do not open
a pull request unless asked. Vercel serves the repository root; `vercel.json`
holds every rewrite, redirect and header. Adding a page means adding its
rewrite plus the trailing-slash and `index.html` redirects, or the URL
404s in production while working fine locally.

## Lead form captcha and the Apps Script receiver

Step 1 of the lead form is gated by Google reCAPTCHA v2 (checkbox). The
site key is `RECAPTCHA_SITE_KEY` in `assets/site.js`; the secret is the
`RECAPTCHA_SECRET` script property in the Apps Script project. Cloudflare
Turnstile was tried first and dropped: its dashboard steers a new account
towards moving DNS, which Shashi rightly did not want.

- Every row's last column, `captcha`, says `verified`, `not configured`
  or `unverified: <reason>`. Rows are dropped only when the token is
  missing or Google calls it invalid/expired/reused. A failure on our side
  still writes the row. Never make the receiver fail closed on
  configuration errors again — a real test lead was lost that way, and
  its Step 2 then overwrote an older row with the same phone number.
- **Editing a deployment to a new version does not re-prompt for
  permissions.** Adding `UrlFetchApp` to a script whose owner only ever
  authorised Sheets access leaves the web app unable to reach Google
  (`unverified: unavailable ...`). The fix is to run `checkCaptchaSetup`
  from the editor once, which triggers the consent screen and also
  reports whether the secret is accepted.
- To ship a `Code.gs` change without changing `LEAD_ENDPOINT`: Deploy →
  Manage deployments → pencil → Version: New version → Deploy. Only a
  brand-new deployment mints a new `/exec` URL.
- Shashi cannot run the sandbox's browser tests and the sandbox cannot
  reach `geniuscfo.ai`, `google.com` or `script.google.com`, so the live
  captcha and the receiver are verified by Shashi doing one real
  submission and reading the `captcha` column.

## Host redirects belong to Vercel's Domains setting, not vercel.json

A `has: [{type: "host", value: "www.geniuscfo.ai"}]` redirect in
`vercel.json` took the whole site down with ERR_TOO_MANY_REDIRECTS on
11 September 2026: the Vercel project had `www` as the primary domain and
redirected the apex to it, while the config redirected `www` back. Do not
add host-level redirects to `vercel.json`; the canonical host is chosen in
Vercel → Settings → Domains and that setting alone decides the direction.

## Section links stay out of the address bar

`assets/site.js` intercepts same-page `#section` links and strips the
fragment after scrolling (and on arrival from another page), so shared
URLs read `/ca-firms` rather than `/ca-firms#product`. Links keep their
`href="#…"`; only the address bar changes. A link to an id that does not
exist on the page falls through to native behaviour and leaves the hash —
that is how a stray `#how` in the CA-firms footer was caught.

## Two routes out of the lead form

Business visitors do not book a demo. On `/business`, Step 3 of the lead
form sends them to the Razorpay page `https://rzp.io/rzp/tryfor9`
(`TRIAL_PAYMENT_URL` in `assets/site.js`); Razorpay forwards them to the
app sign-up and the 7-day trial starts there. CA and vCFO firms keep the
Cal.com booking: on `/ca-firms` always, and on `/business` whenever the
role chip is a firm. The markup decides where the payment route exists
(the `[data-lead-payment]` panel is only on `/business`); the role decides
who takes it. Every business-facing CTA reads exactly "Try for ₹9";
"Request Access" and "Book a demo" survive only for firms.

Consequences:

- The Step 2 POST is sent with `keepalive` because the page leaves for
  Razorpay half a second later. Do not remove that flag.
- `generate_lead` still comes only from a Cal.com booking, so business
  leads no longer raise it. The page pushes `lead_payment_redirect` just
  before leaving; the payment completes on Razorpay and the sign-up on the
  app, neither of which this site can see. Counting a paid trial as a
  conversion is a GTM change, not a website change.
- The trial is 7 days for both audiences: ₹9 for businesses, free on
  request for firms. The FAQ explaining the ₹9 (fake sign-ups burning the
  trial AI credits) is on `/business` and `/pricing`, in the visible text
  and the JSON-LD, and in both llms files. Keep all four in step.
- The sandbox cannot reach `rzp.io`, so the redirect is verified by
  intercepting the navigation in Playwright; the real payment page is
  checked by Shashi.

## Working style that has held

Shashi asks for changes and then says "merge to main" or "push to main".
Fast-forward `main` to the working branch and push both; no pull request.
