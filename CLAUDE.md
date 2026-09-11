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
