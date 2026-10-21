# The hook swap: one page, many ads

A persona campaign runs a dozen ads at one landing page. Each ad's opening line
has to be the first thing its visitor reads, or the ad and the page feel like
two different offers. The swap does that without a dozen pages: the ad carries
its route id in the URL, and the page sets its headline from a fixed map.

Everything below the headline is identical for every visitor.

**Contents:** [The contract](#the-contract) · [Where the script goes](#where-the-script-goes) · [Headline size](#headline-size) · [Ad URLs](#ad-urls) · [Keeping the copies in step](#keeping-the-copies-in-step)

## The contract

- **Parameter:** `r` first, then `utm_content` if `r` is absent. The id is
  carried twice because some ad platforms strip parameters they do not
  recognise, and `utm_content` always survives.
- **Matching is exact**, against the keys of the map. Any other value, or none,
  renders the default hook.
- **Nothing from the URL is ever printed.** Only values from the map are
  written, and only with `textContent`.
- **Canonical, `og:title` and `<title>` never change** with the parameter. One
  URL, one canonical, one share card.
- The map lives in `assets/hooks.json` as the record, and is **inlined into the
  page** at build time so there is no fetch and no flash of the default.

## Where the script goes

Split in two, and this placement is the whole trick:

**In `<head>`** — resolve the route and push the analytics event. This cannot
touch the headline, because the `<h1>` does not exist yet.

```html
<script>
(function () {
  var HOOKS = { /* inlined from assets/hooks.json */ };
  var DEFAULT = "P1-A01-F12";
  var asked = "";
  try {
    var params = new URLSearchParams(window.location.search);
    asked = params.get("r") || params.get("utm_content") || "";
  } catch (error) { /* no URLSearchParams — the default hook stands */ }

  // hasOwnProperty, not `in`: `?r=constructor` must not match a prototype key.
  var matched = Object.prototype.hasOwnProperty.call(HOOKS, asked) ? asked : null;
  window.__gcHook = { route: matched || "default", lines: HOOKS[matched || DEFAULT] };

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: "p1_hook_view", route_id: matched || "default" });
})();
</script>
```

**Immediately after the `</h1>`** — apply it. The parser has just created the
element and its spans, and nothing has painted, so the swap costs no layout
shift.

```html
<h1 class="hook-h1"><span class="hook-line" id="hook-l1">Default line one.</span><span class="hook-line hook-line-2" id="hook-l2">Default line two.</span></h1>
<script>
(function () {
  var hook = window.__gcHook;
  if (!hook || !hook.lines) return;
  var one = document.getElementById("hook-l1");
  var two = document.getElementById("hook-l2");
  var main = document.getElementById("main");
  if (one) one.textContent = hook.lines.l1;
  if (two) {
    if (hook.lines.l2) { two.textContent = hook.lines.l2; two.hidden = false; }
    else { two.hidden = true; }
  }
  if (main) main.setAttribute("data-route", hook.route);
})();
</script>
```

A route whose `l2` is `null` hides the second line rather than leaving an empty
one. `data-route` on `<main>` gives GTM and CSS something to key on.

The default hook is in the HTML, so with JavaScript off the page is complete
and the default stands.

## Headline size

The brand book sets an 11ch measure for display type. At the site's 80px `h1`
that stacks a two-line hook into six lines — a 470px headline that pushes the
hero CTA to y=1004 on a 900px viewport, below the fold on the one page whose
entire job is the click.

Use the site's own `--max-head` measure and step the type down one notch:

```css
.your-hero .hook-h1 {
  max-width: var(--max-head);
  font-size: clamp(2.375rem, 5.2vw, 4.25rem);
  text-wrap: balance;
}
```

Then check every route, not just the default. `qa-page.js --hooks` reports the
CTA's y position and the CLS on the shortest and longest hooks.

## Ad URLs

```
https://geniuscfo.ai/<path>?r=<ROUTE>&utm_source=meta&utm_medium=paid&utm_campaign=<campaign>&utm_content=<ROUTE>
```

`utm_source` changes per platform; everything else stays. When handing these to
Shashi, give a spreadsheet with one row per ad — route id, the headline that
route puts on the page, and the full link as a clickable cell — and verify the
links by driving them from the finished spreadsheet, not from the source data.
A typo there sends an ad to the wrong headline and nothing complains.

## Keeping the copies in step

The hook lines exist in four places. Change one, change all four:

1. the inlined map in the page
2. `assets/hooks.json`
3. the ad-link spreadsheet
4. the ad creative itself — which lives outside this repository, so say so in
   the hand-back
