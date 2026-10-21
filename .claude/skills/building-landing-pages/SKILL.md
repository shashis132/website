---
name: building-landing-pages
description: Builds, changes and QA-checks pages on the GeniusCFO marketing site (geniuscfo.ai) in this repository. Covers turning a persona landing-page brief into a working page, the ad hook swap keyed to a route id, vercel.json routing, sitemap and llms.txt entries, the lead form and its Apps Script receiver, and a Playwright QA gate. Use when adding or editing any page under /business, /ca-firms, /pricing, /stories or /blog, when a P-series persona brief needs building, when changing the lead form, captcha or Razorpay flow, or when a change touches assets/site.js, assets/site-v4.css or the JSON-LD nodes repeated on every page. Also use before pushing any page change, to run the routing, schema-drift and browser checks.
---

# Building landing pages on the GeniusCFO site

`CLAUDE.md` is the operating memory for this repository and is already loaded:
it owns the apex-URL rule, the branch and merge workflow, how images get in,
and who Shashi is. This skill does not repeat it. This skill is the page build
itself: the steps, the shared code that bites, and the gate.

Where this file and a reference file disagree, this file wins.

The `persona-to-landing-page` skill writes these briefs; this one builds what
they specify. If there is no brief yet, that skill comes first.

## Pick the path

- **New page from a persona brief** (a P-series brief naming a path, hooks and
  chapter copy) → the full workflow below.
- **Editing an existing page's copy or layout** → skip to step 4, then run the
  gate in step 7.
- **Changing the lead form, the captcha or the Razorpay flow** → read
  [reference/lead-capture.md](reference/lead-capture.md) first. Deleting a
  field from the markup is not enough and fails silently.
- **Any change touching `assets/site.js`, `assets/site-v4.css`, or a JSON-LD
  node** → read [reference/shared-files.md](reference/shared-files.md) first.
  These are live on every page.

## Workflow

1. **Read the brief end to end before writing anything.** A brief states what
   is copied verbatim from an existing page and what is new. Copy the verbatim
   parts by actually copying them, not by retyping.

2. **Decide the open questions the brief leaves.** A good brief lists them with
   a default. Build the default and say so in the hand-back. Do not stall.

3. **Create the page.** `<path>/index.html`, modelled on the nearest existing
   page. Asset paths are root-absolute (`/assets/…`), never `../assets/…`:
   a clean URL has no trailing slash, so a relative path resolves against the
   parent and silently breaks one directory down.

4. **Write the copy and components.** Page-specific CSS goes in its own
   stylesheet (`assets/<page>.css`), never into `site-v4.css`. Reuse the site's
   existing components — `.chapter`, `.card`, `.screen-window`, `.comparison-table`,
   `.steps`, `.faq-list`, `.plan-selector`, `.lead-form` — before inventing one.

5. **Wire the hook swap**, if the brief has one. See
   [reference/hook-swap.md](reference/hook-swap.md).

6. **Route it.** `vercel.json` needs the rewrite plus the trailing-slash and
   `/index.html` redirects; then `sitemap.xml`, `llms.txt` and `llms-full.txt`.
   Step 7's routing check verifies all of it.

7. **Run the gate.** All three, from the repository root:

   ```bash
   node .claude/skills/building-landing-pages/scripts/check-routing.js
   node .claude/skills/building-landing-pages/scripts/check-shared-schema.js

   python3 -m http.server 8099 &
   NODE_PATH=/opt/node22/lib/node_modules \
     node .claude/skills/building-landing-pages/scripts/qa-page.js \
     http://127.0.0.1:8099/<path>/ --hooks assets/hooks.json
   ```

   Fix and re-run until all three pass. `--hooks` is only for a page with a
   hook swap. See [reference/qa.md](reference/qa.md) for what each covers, what
   this sandbox cannot reach, and what still needs Shashi.

8. **Look at it.** Screenshot the page and read the screenshots. The gate
   cannot see that a headline pushed the button off the screen, that a phone
   screenshot got crop-mangled into a 16:9 card, or that a column's rhythm
   broke. Every visual defect this session produced was found this way and none
   of them showed up in markup.

9. **Hand back in plain language**, per `CLAUDE.md`. Name the decisions you
   took, anything you could not verify from the sandbox, and anything that
   needs Shashi's hands.

## The traps

Each of these cost time on a real build and none of them announce themselves.

| Trap | What happens | Where |
|---|---|---|
| Blanket find-and-replace across a page | Rewords the shared `Organization` JSON-LD, giving one `@id` two definitions | [shared-files](reference/shared-files.md) |
| `.hero h1 { max-width }` | Beats a single page class on specificity, so the page's own measure silently does nothing | [shared-files](reference/shared-files.md) |
| `data-word-rise` on a headline | Flattens `textContent` and destroys child elements, including hook spans | [shared-files](reference/shared-files.md) |
| Deleting a form field's markup | An unguarded validation rule reads an absent field as empty, so validation fails forever against an error node that no longer exists and the submit button does nothing. `company`, `email` and `turnover` are guarded; `name`, `phone`, `role` and `consent` are not | [lead-capture](reference/lead-capture.md) |
| Removing the booking step | `route()` sends firm roles to booking; with no booking panel it routes into nothing | [lead-capture](reference/lead-capture.md) |
| Removing the captcha | The Apps Script receiver treats a missing token as a bot and silently drops every lead, unless the page's path is in `CAPTCHA_EXEMPT_PATHS` and the script has been redeployed | [lead-capture](reference/lead-capture.md) |
| Hook script in `<head>` only | The `<h1>` does not exist yet, so nothing is swapped | [hook-swap](reference/hook-swap.md) |
| `../assets/…` on a nested page | Resolves one directory off, because a clean URL has no trailing slash | this file, step 3 |
| Missing `vercel.json` rewrite | Works locally, 404s in production | `check-routing.js` |
| The brand book's 11ch headline measure | Stacks a long hook into six lines and pushes the CTA below the fold | [hook-swap](reference/hook-swap.md) |
| A phone screenshot in `.card-media` | Cropped to a 16:9 band showing only its header | this file, step 8 |
| `.comparison-table` stacked on phones | Prints each column name from `data-label` in mono uppercase, setting the wordmark as GENIUSCFO | [shared-files](reference/shared-files.md) |

## Reference

- [reference/shared-files.md](reference/shared-files.md) — the files live on
  every page: the JSON-LD `@id` nodes, `site-v4.css` specificity and
  behaviours, the footer.
- [reference/hook-swap.md](reference/hook-swap.md) — one page, many ads: how
  the headline is swapped from the route id in the URL.
- [reference/lead-capture.md](reference/lead-capture.md) — the lead form's
  shared machinery, its variants, and the Apps Script receiver.
- [reference/qa.md](reference/qa.md) — what each script covers, what the
  sandbox cannot reach, and what only Shashi can verify.

`evals/` holds test scenarios for maintaining this skill. They are not needed
at runtime.
