#!/usr/bin/env python3
"""Build the responsive derivatives for a story from its master images.

Masters live in   assets/stories/<slug>/masters/
Derivatives go to assets/stories/<slug>/v1/

Run:  python3 tools/build-story-images.py the-second-job
The masters themselves are never modified and are not shipped to the page
(.vercelignore keeps the masters/ folder off the deployment).
"""
import sys
from pathlib import Path

from PIL import Image
import pillow_avif  # noqa: F401  (registers the AVIF plugin)

ROOT = Path(__file__).resolve().parent.parent

# name -> (master file, role, widths)
# "banner"  the masthead image
# "figure"  an inline story illustration
# "screen"  a product capture; trimmed to its content box first
PLAN = {
    "the-second-job": {
        "the-second-job":      ("01-counting.png",        "banner", (360, 540, 768, 1080)),
        "forty-five-machines": ("02-floor.png",           "figure", (450, 680, 900)),
        "cash-gap-alert":      ("03-cash-gap-alert.png",  "screen", (450, 680, 900)),
        "the-worst-hour":      ("04-awake.png",           "figure", (450, 680, 900)),
        "payday-the-7th":      ("05-payday-calendar.png", "figure", (450, 680, 900)),
        "forty-five-envelopes":("06-envelopes.png",       "figure", (450, 680, 900)),
    }
}
SOCIAL_OF = {"the-second-job": "the-second-job"}
SOCIAL_WIDTH = 1200


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
    masters = ROOT / "assets" / "stories" / slug / "masters"
    out_dir = ROOT / "assets" / "stories" / slug / "v1"

    missing = [f for _, (f, _, _) in plan.items() if not (masters / f).exists()]
    if missing:
        print(f"Missing masters in {masters}:")
        for f in missing:
            print(f"  - {f}")
        return 1

    for stem, (fname, role, widths) in plan.items():
        img = Image.open(masters / fname)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        if role == "screen":
            img = trim_to_content(img)
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
