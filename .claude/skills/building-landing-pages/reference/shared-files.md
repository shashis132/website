# Shared files: live on every page

Three things in this repository are repeated on every page. Editing one page's
copy of them splits the site.

**Contents:** [The JSON-LD `@id` nodes](#the-json-ld-id-nodes) · [Known drift](#known-drift) · [`assets/site-v4.css`](#assetssite-v4css) · [`assets/site-v4.js`](#assetssite-v4js) · [The footer](#the-footer)

## The JSON-LD `@id` nodes

Every page's `<script type="application/ld+json">` carries an `@graph`. Three
nodes in it are not about the page — they are about the company and the
product, and they share one `@id` across the whole site:

| `@id` | Node |
|---|---|
| `https://geniuscfo.ai/#organization` | `Organization` |
| `https://geniuscfo.ai/#website` | `WebSite` |
| `https://geniuscfo.ai/#software` | `SoftwareApplication`, including the price `Offer` nodes |

**One `@id` must have exactly one definition.** Two pages describing the same
`@id` differently is a contradiction a search engine cannot resolve. This broke
the site's schema on 11 September 2026, when `#organization` carried the apex
URL on the product pages and `www` on the stories.

The failure mode is mundane: a find-and-replace over a page's copy also hits
the `Organization` description, because that description mentions the same
words the page does. The sellers page's "CA" to "accountant" swap would have
done exactly this.

So: **never let a page-wide replacement touch these nodes.** Do replacements as
an explicit list of strings with expected counts, not a blanket regex, and run:

```bash
node .claude/skills/building-landing-pages/scripts/check-shared-schema.js
```

The page-specific nodes — `WebPage`, `FAQPage`, `BreadcrumbList`, `Article`,
`Blog` — carry the page's own `@id` and are yours to write freely.

Prices live in the `Offer` nodes and in the `.plan-option` `data-*` attributes.
They are read from one source and never retyped; `/pricing` is that source.

### Known drift

The repository already has drift that predates the check, recorded in
`scripts/known-drift.json`. It is **outstanding work, not an approved pattern**:

- `#organization` — the blog and stories pages define it minimally, with a
  different logo and no `description`, `sameAs`, `areaServed`, `contactPoint`
  or `knowsAbout`. The product pages define it fully.
- `#software` — `description`, `featureList`, `offers` and `url` differ between
  the business and CA-firm pages.
- `blog#blog` — the article page carries a stub of the node the blog index
  defines in full.

The check passes on these and fails on anything new, so a new page cannot add
more. After deliberately fixing one, re-record with `--update-baseline`.

## `assets/site-v4.css`

Page-specific CSS belongs in its own stylesheet. Two behaviours catch people:

**Specificity.** `.hero h1 { max-width: var(--max-head); }` is `(0,1,1)` and
beats a bare page class like `.hook-h1` at `(0,1,0)`. A page-level override of
anything inside `.hero` needs two classes:

```css
.sellers-hero .hook-h1 { max-width: …; }   /* (0,2,1) — wins */
```

Symptom: the rule appears in the stylesheet, the browser computes the old
value, and nothing looks wrong in the source.

**The tint wash replaced the paper/ink alternation.** The brand book describes
full-bleed chapters alternating ink and paper. The site does not do this any
more, by a documented decision in the stylesheet: the page stays a bright room
throughout and only the product objects are dark. Alternate with
`.chapter.wash-tint`, not with dark sections.

**`.comparison-table` on phones** stacks each row into a card and prints every
column name from its `data-label` in mono uppercase. For the GeniusCFO column
that sets the wordmark as GENIUSCFO, which the brand rules forbid. A page using
this table needs:

```css
@media (max-width: 700px) {
  .your-table td.gcfo-mark::before {
    font-family: var(--font-body); font-weight: 600;
    letter-spacing: 0; text-transform: none;
  }
}
```

`/business` still has this bug.

## `assets/site-v4.js`

**`data-word-rise`** splits an element's `textContent` into words and rebuilds
its children. Any child element inside that heading is destroyed. Never put it
on a headline that contains spans — a swappable hook, a highlighted word, a
line break you control.

**`data-scroll-fade`** is opacity only, respects `prefers-reduced-motion`, and
leaves the text in the DOM at full size. Safe on any heading.

## The footer

Every page carries the same footer markup. A link added to one must be added to
all, or the site's navigation disagrees with itself.

Footer link tap targets are set once in `site-v4.css`
(`.footer-col a { min-height: 44px }`), not as inline styles on whichever links
someone remembered. Mixing the two leaves a column with two row heights that
reads as a gap.

Adding a *story* or an *article* is different: those are listed by their
section index only, and must not touch any other page. See `CLAUDE.md`.
