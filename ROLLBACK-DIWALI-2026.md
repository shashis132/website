# Diwali 2026 offer: deployment record and rollback

Deployed 3 November 2026 at Shashi's request. Not published (`.vercelignore` excludes `*.md`).

## What the offer is

₹5,000 of AI credits with any monthly plan and ₹30,000 with any 3-month plan, on every plan (Light, Pro, Pro Max, Team, Enterprise), for plans bought by 11:59 pm IST on Monday 9 November 2026. Unused credits carry over.

## What changed on the site

Nothing in the existing page content was edited. Two new files add everything when a page loads:

| File | What it does |
| --- | --- |
| `assets/diwali-2026.js` | Banner at the top of every page (stands in for the trial strip while showing; closable; the close is remembered across geniuscfo.ai and app.geniuscfo.ai). Offer band, billing-switch tags, summary credit line, a credit block on every plan card and a note under the plan CTA, in every `[data-plan-selector]` (business and firm). On `/pricing`: a "Diwali offer" row in the trial list and a Diwali column in the plan table. |
| `assets/diwali-2026.css` | Styles for the above only. |

Each of these 13 pages got two marked blocks, `<!-- DIWALI-2026 start ... -->` to `<!-- DIWALI-2026 end -->`: one stylesheet link before `</head>` and one script before `</body>`.

```
blog/index.html                         business/sellers/index.html
blog/through-the-glass/index.html       ca-firms/index.html
business/index.html                     pricing/index.html
business/restaurant-groups/index.html   privacy/index.html
business/restaurants/index.html         stories/index.html
stories/every-invoice-looked-fine/index.html
stories/the-second-job/index.html
stories/your-accountant-is-not-behind/index.html
```

`vercel.json`: `diwali-2026.css|diwali-2026.js` added to the must-revalidate cache header list.

## It switches itself off

`assets/diwali-2026.js` does nothing after 11:59 pm IST on 9 November 2026 (`END` near the top). From then on every page looks exactly as it did before, with the trial strip back, even if nobody rolls anything back. Rollback is housekeeping, not urgent.

## To extend the offer

Change `END` in `assets/diwali-2026.js` and the dates in the copy strings in the same file (search for "9 November" and "9 Nov"), then bump `?v=` on the 13 script and link tags. The app banner (`gcfo-diwali-banner.js`, held in the claude.ai Project, not in this repo) has its own `END` and needs the same change.

## To roll back

The tag `pre-diwali-2026` marks `main` exactly as it was before this deployment (commit `0a26c73`).

1. Delete `assets/diwali-2026.js` and `assets/diwali-2026.css`.
2. Remove every `DIWALI-2026 start` to `DIWALI-2026 end` block: `grep -rln "DIWALI-2026" --include=*.html .` should then print nothing.
3. Remove `|diwali-2026.css|diwali-2026.js` from the cache header in `vercel.json`.
4. If `/diwali` was published: delete `diwali/`, its rewrite and its two redirects in `vercel.json`, and any sitemap or `CAPTCHA_EXEMPT_PATHS` entry added for it. Better still, replace it with a permanent redirect from `/diwali` to `/pricing` so old ad links still land.
5. Commit, fast-forward `main`, push.

Equivalent shortcut when nothing else has touched those files since: `git revert` the Diwali commits on `main`.

Check afterwards: `git diff pre-diwali-2026 -- . ':!ROLLBACK-DIWALI-2026.md'` should list only changes made after the offer for other reasons.

## Testing hooks

`?diwali_now=2026-11-08` pretends it is that date (IST). `?diwali_reset=1` forgets a closed banner.
