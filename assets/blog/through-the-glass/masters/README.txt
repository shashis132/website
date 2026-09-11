Master images for /blog/through-the-glass
=========================================

The masters are NOT kept in this repository. Only the derivatives in
../v1/ are committed and deployed. This folder exists to hold the
masters temporarily while rebuilding, and to record which artwork
belongs to which prefix.

STATUS AT PUBLICATION: the three masters below had not reached the
repository when the article went live, so the page ships without them.
Both raster slots are commented out in
blog/through-the-glass/index.html and are marked "ARTWORK SLOT" — the
page renders correctly without them, and the article's two-architecture
diagram is inline SVG, so it needs no file at all.

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

Finally, in blog/through-the-glass/index.html:

  - uncomment the two "ARTWORK SLOT" figures (masthead band, and the
    25-capture sheet in section 03) and delete the surrounding notes;
  - repoint og:image and twitter:image from the interim
    /assets/og-geniuscfo.png to
    /assets/blog/through-the-glass/v1/og-through-the-glass.jpg, set
    og:image:width to 1200 and og:image:height to 627, og:image:type to
    image/jpeg, and update the two image alt strings;
  - add an ImageObject node to the JSON-LD @graph for the masthead and
    point the Article's "image" at it, as the story pages do.

Commit the regenerated v1/ folder — and delete the masters again, so
they do not enter the repository. .vercelignore excludes this folder
from the deployment, so a master left here by accident is never
published, but it would still be committed.
