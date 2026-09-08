Master images for /stories/the-second-job
=========================================

Drop the six supplied illustrations here, keeping the numeric prefix.
Any format works (.png .jpg .jpeg .webp .tif) — the build script finds
each master by its prefix, so 01-counting.jpg is as good as 01-counting.png.

  01-*  Masthead. Desk under one lamp: two ruled ledger sheets, a hand
        resting on them, a pen and a closed book. 3:04 a.m.
  02-*  "Forty-five machines, forty-five people". The unit seen through
        the office window.
  03-*  Product capture. The "Cash gap in 18 days" alert. The delivered
        artwork wraps the card in its own window frame and chrome dots;
        the build crops that away, because the site draws the window
        chrome itself (.screen-window::before in site-v4.css). Ship the
        card with a warm border on the dark ground and it will be found.
  04-*  "The worst hour of the day". The dark bedroom, awake on the bed.
  05-*  "Payday is the 7th". The office doorway, calendar with the 7th
        circled in red.
  06-*  "The 7th, as usual". A pay envelope passing between two hands.

Then, from the repository root:

  python3 tools/build-story-images.py the-second-job

That writes every AVIF/WebP derivative and the social JPEG into ../v1/.
Commit the regenerated v1/ folder together with the masters.

Original delivery names, for traceability against the art folder:

  01-counting.png        <- ART-L1.png
  02-floor.png           <- ART-L2.png
  03-cash-gap-alert.png  <- ART-L3_simulated-alert.png
  04-awake.png           <- ART-M1.png
  05-payday-calendar.png <- ART-M2.png
  06-envelopes.png       <- ART-M3.png

Masters are excluded from the deployment by .vercelignore; they are kept
in the repository so the derivatives can always be rebuilt.
