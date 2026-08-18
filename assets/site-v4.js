/* ==========================================================================
   GeniusCFO V4 — behaviour layer for the Cluely-adapted surface.

   Loads AFTER assets/site.js and does not touch it. site.js keeps sole
   ownership of the lead form, plan selector, UTM preservation, image
   lightbox, mobile menu and access strip. Everything here is presentation.

   Five behaviours, matching Cluely-Design-Language-AI-Spec.md §8:
     1. Know-more progressive disclosure   (Content directions, slide 2)
     2. Floating CTA pill past the hero    (spec §9)
     3. Scroll-linked heading opacity      (spec §8.2)
     4. Hero word-rise on load             (spec §8.1)
     5. Infinite marquee                   (spec §8.3)

   Every one degrades to fully visible, fully readable content when
   JavaScript is unavailable. Nothing here hides text from a crawler.
   All of it is skipped under prefers-reduced-motion.
   ========================================================================== */

(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. Know more ---------------------------------------------
     Markup contract:
       <div class="more-panel" id="x" data-more-panel>  ...extra content... </div>
       <div class="know-more">
         <button data-know-more="x"
                 data-label-more="Know more"
                 data-label-less="Show less">Know more</button>
       </div>
     The panel ships visible. Script collapses it, so no-JS users see
     everything and search engines index everything.                        */

  document.querySelectorAll("[data-know-more]").forEach((button) => {
    const panel = document.getElementById(button.getAttribute("data-know-more"));
    if (!panel) return;

    const labelMore = button.dataset.labelMore || "Know more";
    const labelLess = button.dataset.labelLess || "Show less";

    panel.classList.add("is-collapsible");
    panel.setAttribute("aria-hidden", "true");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", panel.id);
    button.hidden = false;
    button.textContent = labelMore;

    button.addEventListener("click", () => {
      const open = panel.classList.toggle("is-open");
      panel.setAttribute("aria-hidden", open ? "false" : "true");
      button.setAttribute("aria-expanded", open ? "true" : "false");
      button.textContent = open ? labelLess : labelMore;

      if (!open) {
        const top = panel.getBoundingClientRect().top;
        if (top < 0) {
          button.scrollIntoView({
            block: "center",
            behavior: reduceMotion ? "auto" : "smooth"
          });
        }
      }
    });
  });

  /* ---------- 2. Floating CTA pill --------------------------------------
     Appears top-right once scrolled past the hero, per spec §9.            */

  const floatingCta = document.querySelector("[data-floating-cta]");
  const hero = document.querySelector(".hero");

  if (floatingCta && hero && "IntersectionObserver" in window) {
    new IntersectionObserver(
      ([entry]) => floatingCta.classList.toggle("is-visible", !entry.isIntersecting),
      { rootMargin: "-40px 0px 0px 0px", threshold: 0 }
    ).observe(hero);
  }

  /* ---------- 3. Scroll-linked heading opacity --------------------------
     Headings start near-invisible and reach full opacity as the section
     enters the viewport. Opacity only — the text is always in the DOM at
     full size, so nothing is hidden from assistive tech or crawlers.       */

  if (!reduceMotion && "IntersectionObserver" in window) {
    const headings = document.querySelectorAll("[data-scroll-fade]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-lit");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 }
    );

    headings.forEach((heading) => {
      heading.classList.add("js-scroll-fade");
      observer.observe(heading);
    });
  }

  /* ---------- 4. Hero word-rise -----------------------------------------
     Each word starts one line-height below its final position and rises,
     staggered, behind an overflow mask. Runs once on load.                 */

  if (!reduceMotion) {
    document.querySelectorAll("[data-word-rise]").forEach((node) => {
      const words = node.textContent.trim().split(/\s+/);
      node.textContent = "";

      words.forEach((word, index) => {
        const mask = document.createElement("span");
        mask.className = "word-rise";

        const inner = document.createElement("span");
        inner.textContent = word;
        inner.style.animationDelay = `${index * 55}ms`;

        mask.appendChild(inner);
        node.appendChild(mask);
        if (index < words.length - 1) node.appendChild(document.createTextNode(" "));
      });
    });
  }

  /* ---------- 5. Marquee ------------------------------------------------
     Duplicates the track so translateX(-50%) loops seamlessly. The clone is
     aria-hidden so screen readers read the list once.                      */

  if (!reduceMotion) {
    document.querySelectorAll("[data-marquee]").forEach((track) => {
      Array.from(track.children).forEach((child) => {
        const clone = child.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
      });
    });
  }
})();
