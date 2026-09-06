Master images for /stories/the-second-job
=========================================

Drop the six supplied illustrations here, keeping the numeric prefix.
Any format works (.png .jpg .jpeg .webp .tif) — the build script finds
each master by its prefix, so 01-counting.jpg is as good as 01-counting.png.

  01-*  Masthead. Desk under one lamp: two ruled ledger sheets, a hand
        resting on them, a pen and a closed book. 3:04 a.m.
  02-*  "Forty-five machines, forty-five people". The unit seen through
        the office window.
  03-*  Product capture. The "Cash gap in 18 days" alert. This one is
        trimmed to its content box automatically, so surrounding empty
        canvas is fine.
  04-*  "The worst hour of the day". The dark bedroom, awake on the bed.
  05-*  "Payday is the 7th". The office doorway, calendar with the 7th
        circled in red.
  06-*  "The 7th, as usual". A pay envelope passing between two hands.

Then, from the repository root:

  python3 tools/build-story-images.py the-second-job

That writes every AVIF/WebP derivative and the social JPEG into ../v1/.
Commit the regenerated v1/ folder together with the masters.

The files currently here are labelled placeholders for local preview.
The page must not go live until they are replaced.

Masters are excluded from the deployment by .vercelignore; they are kept
in the repository so the derivatives can always be rebuilt.
