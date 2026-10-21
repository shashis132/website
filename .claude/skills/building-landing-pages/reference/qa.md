# The QA gate

There is no test suite in this repository. These three scripts are the gate,
and they only cover what a machine can decide. Step 8 of the workflow — looking
at screenshots — catches the rest, and caught every visual defect on the last
build.

Run all three from the repository root.

**Contents:** [`check-routing.js`](#check-routingjs) · [`check-shared-schema.js`](#check-shared-schemajs) · [`qa-page.js`](#qa-pagejs) · [Testing a form](#testing-a-form) · [Regression, when shared code changed](#regression-when-shared-code-changed) · [What only Shashi can check](#what-only-shashi-can-check)

## `check-routing.js`

```bash
node .claude/skills/building-landing-pages/scripts/check-routing.js
```

No browser needed. For every `index.html` it finds:

- the canonical tag matches the URL the file path implies
- `og:url` equals the canonical
- `vercel.json` rewrites that URL to the file — **the check that matters**,
  because a missing rewrite works locally and 404s in production
- `vercel.json` redirects the `/` and `/index.html` forms
- `sitemap.xml` lists the canonical
- `llms.txt` names the page, unless it is a story or article covered by its
  section index

Then, across every `.html`, `.txt`, `.xml` and `.json`: no `www.geniuscfo.ai`.

`/business`, `/ca-firms` and `/pricing` shipped before the trailing-slash rule
and work in production without those redirects. They are reported as known gaps
rather than failures, in a named constant at the top of the script.

## `check-shared-schema.js`

```bash
node .claude/skills/building-landing-pages/scripts/check-shared-schema.js
node .claude/skills/building-landing-pages/scripts/check-shared-schema.js --update-baseline
```

No browser needed. Every JSON-LD `@id` that appears on more than one page must
be identical on all of them. The rule is generic, so a shared node added later
is covered without editing the script.

It fingerprints each page's copy of each shared node, so a second edit to an
already-drifted field is caught rather than matching the record and passing.

Known drift lives in `scripts/known-drift.json` and is outstanding work, not an
approved pattern — see
[shared-files.md](shared-files.md). The check fails on anything new. After
deliberately changing a shared node on every page that carries it, re-record
with `--update-baseline` and commit the result.

## `qa-page.js`

```bash
python3 -m http.server 8099 &
NODE_PATH=/opt/node22/lib/node_modules \
  node .claude/skills/building-landing-pages/scripts/qa-page.js \
  http://127.0.0.1:8099/business/sellers/ --hooks assets/hooks.json
```

Needs Playwright and Chromium. In this sandbox Chromium is at
`/opt/pw-browsers/chromium` and the script finds it automatically; Playwright
needs `NODE_PATH=/opt/node22/lib/node_modules`. Never run `playwright install`.

It checks: the page responds, the console is clean, exactly one `<h1>`, the
JSON-LD parses, the canonical equals `og:url`, the FAQ schema matches the
visible answers word for word, the brand copy rules, no `aggregateRating`, the
hero CTA sits above a 900px fold, and no sideways scroll at 360 and 390px.

With `--hooks <file>` it also drives every route in the map, checks the
`utm_content` fallback, checks that a junk, hostile or absent parameter leaves
the default standing without rendering anything from the URL, and measures CLS
on the shortest and longest hooks.

**The brand copy rules are real findings on old pages, not false positives.**
`/business` and `/blog/through-the-glass` both carry em dashes. Fixing them is
the page author's call; a new page comes back clean.

**Expected console noise.** The sandbox cannot reach `google.com`,
`googletagmanager.com`, `rzp.io` or `cal.com`, so reCAPTCHA, GTM, Razorpay and
Cal.com all fail to load. The script filters those and would report any other
error.

## Testing a form

There is no bundled script for this, because the assertions depend on which
fields the page has. Drive the real form with Playwright and check:

- only the intended fields are present
- each one blocks submit when empty or malformed, **and** a complete form
  raises no error — that second half is what catches an unguarded validation
  rule for a field that is no longer there
- every role reaches its intended destination; intercept `https://rzp.io/**`
  rather than letting the navigation out
- the payload carries what the sheet needs, including `landing_path`

Read the page state **inside** the 500ms window before the Razorpay redirect
fires. Afterwards the document is Razorpay's, and querying it returns nothing —
which looks exactly like a failure.

## Regression, when shared code changed

If the change touched `assets/site.js` or `assets/site-v4.css`, prove the other
pages still work before pushing: `/business` still requires all six of its
fields and still switches to "Book a Demo" for a firm role; `/ca-firms` still
validates its own form. A guard added for one page must be inert everywhere
else.

## What only Shashi can check

The live captcha, the real Razorpay page, and the row landing in the Leads
sheet. One real submission covers all three. Ask for it explicitly, and say
what a good result looks like.
