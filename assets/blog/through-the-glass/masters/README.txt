Master images for /blog/through-the-glass
=========================================

These masters ARE kept in this repository, unlike the older stories'.
They arrived by GitHub upload rather than from a designer's machine, so
the repo is the only copy; deleting them would mean another upload
before any future rebuild. .vercelignore excludes masters/ from the
deployment, so they are never served to anyone.

STATUS: built and live. The article renders the 16:7 band full-bleed
between the masthead and the article body, the 25-capture sheet inside
section 03, and the 1200x627 card as the Open Graph and Twitter image.

To rebuild the derivatives
--------------------------

Copy the masters into this folder, keeping the numeric prefix. Any
format works (.png .jpg .jpeg .webp .tif) — the build script finds each
master by its prefix.

  01-*  Masthead band, landscape. The CLEAN version of the glass scene,
        with NO text burned in: a dark room seen through a wall of glass,
        a luminous figure of light pressing its palms against the outside
        of the pane, a single small terminal glowing on a desk far
        inside. Roughly 1600x770. The clean version matters — the page
        renders the headline itself as its h1, so a master carrying the
        same headline would print it twice. Off-ratio is fine:
        .story-banner img is object-fit: cover and crops to 3:2.
  02-*  "One receipt. Twenty-five captures." The five-by-five grid of
        dark screen tiles on a pale ground, labelled 01 GATEWAY OF TALLY
        through 25 ACCEPT? YES, with the list price figure at the top
        right. Delivered as 1600x1200. This is a reconstruction of the
        sequence, not a screen capture, and the caption on the page says
        so. Note: unlike the story alerts, this artwork is NOT wrapped
        in window chrome, so it carries role "figure", not "screen" —
        do not let the alert-card crop run over it.
  03-*  Share card for the link preview, 1200x627. The same glass scene
        WITH the headline and the "EVERY CAPTURE IS BILLED · ₹168 PER
        ENTRY" rule burned in. 1200x627 is the 1.91:1 Open Graph ratio,
        so it fills a Facebook, LinkedIn, WhatsApp or X preview without
        being cropped. Emitted as a single 1200px JPEG, no responsive set.

  There is also a square 1200x1200 card carrying the headline and the
  67,000 / 2,999 comparison. The website does not use it — square cards
  are cropped to 1.91:1 in link previews — but it is the right shape for
  an Instagram or LinkedIn feed post. Keep it with the campaign art.

Then, from the repository root:

  python3 tools/build-story-images.py through-the-glass

That writes the AVIF/WebP derivatives for 01 and 02, and the share-card
JPEG for 03, into ../v1/.

The page markup is already wired to these filenames, so a rebuild alone
is enough — nothing in the HTML needs touching unless the artwork itself
changes shape.

Commit the regenerated v1/ folder. Leave the masters in place.
