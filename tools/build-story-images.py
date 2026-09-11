#!/usr/bin/env python3
"""Build the responsive derivatives for a story or blog post from its masters.

Masters live in   assets/<section>/<slug>/masters/
Derivatives go to assets/<section>/<slug>/v1/
where <section> is "stories" or "blog", per SECTION below.

Run:  python3 tools/build-story-images.py the-second-job
      python3 tools/build-story-images.py through-the-glass
The masters themselves are never modified and are not shipped to the page
(.vercelignore keeps the masters/ folder off the deployment).
"""
import sys
from pathlib import Path

from PIL import Image
import pillow_avif  # noqa: F401  (registers the AVIF plugin)

ROOT = Path(__file__).resolve().parent.parent

# name -> (master prefix, role, widths)
# The master is found by numeric prefix, so any image format works:
# 01-counting.png, 01-counting.jpg and 01-counting.webp are all accepted.
# "banner"  the masthead image
# "figure"  an inline story illustration
# "screen"  a product capture; trimmed to its content box first
# "social"  a share card; emitted only as the 1200px JPEG, no responsive set
SECTION = {
    "every-invoice-looked-fine": "stories",
    "the-second-job":            "stories",
    "through-the-glass":         "blog",
}
PLAN = {
    "the-second-job": {
        "the-second-job":      ("01", "banner", (360, 540, 768, 1080)),
        "forty-five-machines": ("02", "figure", (450, 680, 900)),
        "cash-gap-alert":      ("03", "screen", (450, 680, 900)),
        "the-worst-hour":      ("04", "figure", (450, 680, 900)),
        "payday-the-7th":      ("05", "figure", (450, 680, 900)),
        "forty-five-envelopes":("06", "figure", (450, 680, 900)),
    },
    # /blog/through-the-glass. 03 is the square share card, which is its own
    # artwork rather than a crop of the masthead, so it carries role "social".
    "through-the-glass": {
        "through-the-glass":    ("01", "banner", (360, 540, 768, 1080)),
        "the-loop-25-captures": ("02", "figure", (450, 680, 900)),
        "og-through-the-glass": ("03", "social", ()),
    },
}
SOCIAL_OF = {"the-second-job": "the-second-job"}
SOCIAL_WIDTH = 1200


def crop_to_alert_card(img, pad=8):
    """Crop a simulated-alert capture down to the alert card itself.

    The supplied artwork wraps the card in its own window frame, chrome dots
    and a label. The site draws that chrome itself (.screen-window::before),
    so shipping the frame would render two of everything.

    The card is found by row density rather than by a plain bounding box: its
    warm border runs nearly the full width of the card, while the chrome dots
    are only a few pixels across, so a minimum-run threshold separates them.
    Falls back to trim_to_content when no such band is found.
    """
    rgb = img.convert("RGB")
    px = rgb.load()
    w, h = rgb.size

    def warm(x, y):
        p = px[x, y]
        return p[0] > p[2] + 6 and p[0] > 20

    row_counts = {y: sum(1 for x in range(0, w, 2) if warm(x, y)) for y in range(h)}
    threshold = (w // 2) // 4                      # a quarter of the sampled width
    band = [y for y, c in row_counts.items() if c > threshold]
    if not band:
        return trim_to_content(img)

    top, bottom = min(band), max(band)
    col_counts = {x: sum(1 for y in range(top, bottom + 1, 2) if warm(x, y))
                  for x in range(w)}
    cols = [x for x, c in col_counts.items() if c > 5]
    if not cols:
        return trim_to_content(img)

    return rgb.crop((max(0, min(cols) - pad), max(0, top - pad),
                     min(w, max(cols) + pad), min(h, bottom + pad)))


def trim_to_content(img, tolerance=10):
    """Crop a dark product capture down to the box that actually has content."""
    rgb = img.convert("RGB")
    bg = rgb.getpixel((0, 0))
    px = rgb.load()
    w, h = rgb.size
    step = max(1, min(w, h) // 400)

    def differs(x, y):
        p = px[x, y]
        return (abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2])) > tolerance

    xs, ys = [], []
    for y in range(0, h, step):
        for x in range(0, w, step):
            if differs(x, y):
                xs.append(x)
                ys.append(y)
    if not xs:
        return img
    pad = max(w, h) // 60
    box = (max(0, min(xs) - pad), max(0, min(ys) - pad),
           min(w, max(xs) + pad), min(h, max(ys) + pad))
    return img.crop(box)


def save_set(img, out_dir, stem, widths):
    out_dir.mkdir(parents=True, exist_ok=True)
    made = []
    for width in widths:
        height = round(img.height * width / img.width)
        resized = img.resize((width, height), Image.LANCZOS)
        webp = out_dir / f"{stem}-{width}.webp"
        avif = out_dir / f"{stem}-{width}.avif"
        resized.save(webp, "WEBP", quality=82, method=6)
        resized.save(avif, "AVIF", quality=58, speed=4)
        made.append((webp, width, height))
        made.append((avif, width, height))
    return made


def main():
    slug = sys.argv[1] if len(sys.argv) > 1 else "the-second-job"
    plan = PLAN[slug]
    section = SECTION.get(slug, "stories")
    masters = ROOT / "assets" / section / slug / "masters"
    out_dir = ROOT / "assets" / section / slug / "v1"

    def find(prefix):
        hits = sorted(f for f in masters.glob(f"{prefix}-*")
                      if f.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"})
        return hits[0] if hits else None

    resolved = {stem: find(prefix) for stem, (prefix, _, _) in plan.items()}
    missing = [f"{p}-*" for stem, (p, _, _) in plan.items() if resolved[stem] is None]
    if missing:
        print(f"Missing masters in {masters}:")
        for f in missing:
            print(f"  - {f}")
        return 1

    for stem, (prefix, role, widths) in plan.items():
        src = resolved[stem]
        print(f"{src.name} -> {stem}")
        img = Image.open(src)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        if role == "screen":
            img = crop_to_alert_card(img)
        if role == "social":
            out_dir.mkdir(parents=True, exist_ok=True)
            height = round(img.height * SOCIAL_WIDTH / img.width)
            card = img.convert("RGB").resize((SOCIAL_WIDTH, height), Image.LANCZOS)
            path = out_dir / f"{stem}.jpg"
            card.save(path, "JPEG", quality=84, optimize=True, progressive=True)
            print(f"  {path.relative_to(ROOT)}  {SOCIAL_WIDTH}x{height}  "
                  f"{path.stat().st_size // 1024} KB")
            continue
        for path, w, h in save_set(img, out_dir, stem, widths):
            print(f"  {path.relative_to(ROOT)}  {w}x{h}  {path.stat().st_size // 1024} KB")

        if SOCIAL_OF.get(slug) == stem:
            height = round(img.height * SOCIAL_WIDTH / img.width)
            social = img.convert("RGB").resize((SOCIAL_WIDTH, height), Image.LANCZOS)
            path = out_dir / f"{stem}-social.jpg"
            social.save(path, "JPEG", quality=84, optimize=True, progressive=True)
            print(f"  {path.relative_to(ROOT)}  {SOCIAL_WIDTH}x{height}  "
                  f"{path.stat().st_size // 1024} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
