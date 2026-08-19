/* ==========================================================================
   GeniusCFO — logo band wiring.

   A third, deliberately separate layer. assets/site.js owns behaviour and
   assets/site-v4.js owns presentation; both are classic scripts. This one is
   an ES module because geniuscfo-logo-animation.js is, and a browser with no
   module support simply skips the tag and keeps the static logo the markup
   already renders.

   The brief asks for the mark to animate every time the user scrolls past it,
   and on click or tap. The vendor module's own autoplay disconnects after the
   first play, so autoplay is off here and the observer below drives it:

     enters the viewport  -> play from the top
     leaves the viewport  -> rewind to frame 0 while nobody is looking, so the
                             next entry starts clean with no visible jump
     click / tap / Enter  -> play again on demand

   Under prefers-reduced-motion the module resolves straight to the finished
   logo and play() is a no-op, so the button stays harmless and no frame 0 is
   ever shown. See geniuscfo-animated-logo-spec.md sections 8.1 and 12.
   ========================================================================== */

import { mountLogo } from "./geniuscfo-logo-animation.js?v=20260819-v6";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelectorAll("[data-gcfo-logo]").forEach((host) => {
  const api = mountLogo(host, { autoplay: false });
  if (!api) return;

  if (reduceMotion) return; // settled logo is already on screen; leave it be

  api.seek(0);

  if (typeof IntersectionObserver === "function") {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) api.play();
          else api.seek(0);
        });
      },
      { threshold: 0.45 },
    );
    io.observe(api.element);
  } else {
    api.play();
  }

  host.addEventListener("click", () => api.play());
});
