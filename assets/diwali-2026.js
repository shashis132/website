/*
 * GeniusCFO · Diwali 2026 offer (temporary)
 *
 * Adds the Diwali banner to every page, the Diwali AI credits to every
 * plan selector, the /pricing trial list and the /pricing plan table, and the
 * festive hero (lights, lanterns, diyas) on /business, /business/restaurants,
 * /business/sellers and /ca-firms.
 * Nothing in the page markup is edited: this file and diwali-2026.css add
 * everything at load, so taking them out restores the site exactly.
 *
 * It switches itself off after 11:59 pm IST on 9 November 2026, so the site
 * looks as before even if nobody removes it. Full rollback steps:
 * ROLLBACK-DIWALI-2026.md in the repository root.
 *
 * Offer: ₹5,000 of AI credits with any monthly plan, ₹30,000 with any 3-month
 * plan, on every plan, for plans bought by the deadline. Credits carry over.
 *
 * Testing (no effect on real visitors):
 *   ?diwali_now=2026-11-08   pretend it is that date (IST)
 *   ?diwali_reset=1          forget a closed banner
 */
(function () {
  "use strict";

  var START = Date.UTC(2026, 10, 1, 18, 30, 0);  // 2 Nov 2026, 00:00 IST
  var END = Date.UTC(2026, 10, 9, 18, 29, 59);   // 9 Nov 2026, 23:59:59 IST
  var IST = 5.5 * 3600 * 1000;
  var DAY = 86400 * 1000;
  var COOKIE = "gcfo_diwali26_closed";
  var BANNER_ID = "gcfo-diwali";

  function param(name) {
    try { return new URLSearchParams(window.location.search).get(name); } catch (e) { return null; }
  }

  function now() {
    var forced = param("diwali_now");
    if (forced && /^\d{4}-\d{2}-\d{2}$/.test(forced)) return Date.parse(forced + "T12:00:00+05:30");
    return Date.now();
  }

  var T = now();
  if (T < START || T > END) return;

  function pushDataLayer(event, extra) {
    try {
      if (window.dataLayer && typeof window.dataLayer.push === "function") {
        var payload = { event: event };
        for (var k in extra) payload[k] = extra[k];
        window.dataLayer.push(payload);
      }
    } catch (e) { /* tracking never breaks the page */ }
  }

  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  var DIYA = '<svg class="dw-diya" viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
    '<path d="M16 3.5c2.6 3.4 3.9 5.9 3.9 7.9a3.9 3.9 0 0 1-7.8 0c0-2 1.3-4.5 3.9-7.9z" fill="#ff9f1c"/>' +
    '<path d="M16 8.6c1 1.4 1.5 2.4 1.5 3.2a1.5 1.5 0 0 1-3 0c0-.8.5-1.8 1.5-3.2z" fill="#fafaf8"/>' +
    '<path class="dw-diya-bowl" d="M3.5 18.2h25c-.9 5.3-6 9.3-12.5 9.3S4.4 23.5 3.5 18.2z"/>' +
    "</svg>";

  var path = (window.location.pathname || "/").replace(/\/+$/, "") || "/";
  var isFirmPage = path === "/ca-firms" || path.indexOf("/ca-firms/") === 0 ||
    (path === "/pricing" && param("audience") === "ca-firms");

  /* ------------------------------------------------------------------
     1. Banner
     ------------------------------------------------------------------ */

  function cookieDomain() {
    return /(^|\.)geniuscfo\.ai$/.test(window.location.hostname) ? "; domain=.geniuscfo.ai" : "";
  }
  function isClosed() {
    try { return document.cookie.split(";").some(function (c) { return c.trim().indexOf(COOKIE + "=") === 0; }); }
    catch (e) { return false; }
  }
  function setClosed() {
    try {
      document.cookie = COOKIE + "=1; expires=" + new Date(END + DAY).toUTCString() + "; path=/" + cookieDomain() +
        "; samesite=lax" + (window.location.protocol === "https:" ? "; secure" : "");
    } catch (e) {}
  }
  function clearClosed() {
    try { document.cookie = COOKIE + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + cookieDomain(); } catch (e) {}
  }

  function countdown() {
    var left = Math.floor((END + IST) / DAY) - Math.floor((T + IST) / DAY);
    if (left === 0) return "Ends today";
    if (left === 1) return "Ends tomorrow";
    if (left === 2 || left === 3) return "Ends in " + left + " days";
    return "";
  }

  function ctaFor(audience) {
    if (audience === "firm") {
      return { label: "Book a Demo", href: path === "/ca-firms" ? "#demo" : "/ca-firms#demo", firm: true };
    }
    if (path === "/pricing" && document.getElementById("book-demo")) return { label: "Try for ₹9", href: "#book-demo" };
    if (path.indexOf("/business") === 0 && document.getElementById("demo")) return { label: "Try for ₹9", href: "#demo" };
    return { label: "Try for ₹9", href: "/business#demo" };
  }

  function mountBanner() {
    if (param("diwali_reset") === "1") clearClosed();
    if (isClosed() || document.getElementById(BANNER_ID)) return;

    var audience = isFirmPage ? "firm" : "business";
    var long = audience === "firm"
      ? "Team and Enterprise: <strong>₹30,000 of AI credits</strong> with any 3-month plan, ₹5,000 with monthly. Subscribe by 9 November."
      : "<strong>₹30,000 of AI credits</strong> with any 3-month plan, ₹5,000 with monthly. Subscribe by 9 November.";
    var short = audience === "firm"
      ? "Team and Enterprise: <strong>+₹30,000 AI</strong> · till 9 Nov"
      : "<strong>₹30,000 of AI credits</strong> on 3-month plans · till 9 Nov";
    var cta = ctaFor(audience);
    var count = countdown();

    var bar = el("div", "dw-banner");
    bar.id = BANNER_ID;
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Diwali offer");
    bar.setAttribute("data-audience", audience);
    bar.innerHTML =
      '<div class="wrap dw-banner-inner">' + DIYA +
        '<p class="dw-banner-copy"><span class="dw-tag">Diwali 2026</span>' +
          '<span class="dw-long">' + long + "</span>" +
          '<span class="dw-short">' + short + "</span>" +
          (count ? '<span class="dw-count">' + count + "</span>" : "") +
        "</p>" +
        '<a class="dw-banner-btn" href="' + cta.href + '">' + cta.label + "</a>" +
        '<button type="button" class="dw-banner-close" aria-label="Close the Diwali offer">' +
          '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
        "</button>" +
      '</div><div class="dw-lights" aria-hidden="true"></div>';

    bar.querySelector(".dw-banner-close").addEventListener("click", function () {
      setClosed();
      if (bar.parentNode) bar.parentNode.removeChild(bar);
      document.documentElement.classList.remove("dw-banner-on");
      pushDataLayer("diwali_banner_close", { banner_audience: audience });
    });
    bar.querySelector(".dw-banner-btn").addEventListener("click", function () {
      pushDataLayer("diwali_banner_click", { banner_audience: audience });
    });

    var strip = document.querySelector("[data-access-strip]");
    var skip = document.querySelector(".skip-link");
    if (strip && strip.parentNode) strip.parentNode.insertBefore(bar, strip);
    else if (skip && skip.parentNode) skip.parentNode.insertBefore(bar, skip.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);

    // The Diwali banner stands in for the trial strip while it is showing.
    document.documentElement.classList.add("dw-banner-on");
    pushDataLayer("diwali_banner_view", { banner_audience: audience });
  }

  /* ------------------------------------------------------------------
     2. Plan selectors (business and firm)
     ------------------------------------------------------------------ */

  var CREDIT = {
    quarterly: { amount: "₹30,000", docs: "about 15,000 documents", tail: "unused credits carry over" },
    monthly: { amount: "₹5,000", docs: "about 2,500 documents", tail: "on 3 months: ₹30,000" }
  };

  function periodOf(selector) {
    var pressed = selector.querySelector('[data-billing-choice][aria-pressed="true"]');
    return pressed && pressed.getAttribute("data-billing-choice") === "monthly" ? "monthly" : "quarterly";
  }

  function adaptSelector(selector) {
    if (selector.hasAttribute("data-diwali")) return;
    selector.setAttribute("data-diwali", "");
    var audience = selector.getAttribute("data-plan-selector") === "firm" ? "firm" : "business";

    // Offer band, above the billing switch
    var band = el("section", "dw-band");
    band.setAttribute("aria-label", "Diwali offer");
    band.innerHTML = DIYA +
      '<div class="dw-band-text">' +
        '<p class="dw-band-label">Diwali 2026 · Until 11:59 pm IST, 9 November</p>' +
        (audience === "firm"
          ? '<p class="dw-band-line">Team and Enterprise carry extra AI credits too: <strong>₹30,000 with 3 months</strong>, ₹5,000 with monthly. Subscribe by 9 November.</p>' +
            '<p class="dw-band-small">Covers routine preparation across your client companies: about 15,000 documents read, posted and matched. Unused credits carry over. Your firm keeps review and sign-off.</p>'
          : '<p class="dw-band-line">Subscribe by 9 November and your plan carries extra AI credits: <strong>₹30,000 with 3 months</strong>, ₹5,000 with monthly.</p>' +
            '<p class="dw-band-small">About 15,000 documents read, posted and matched. Unused credits carry over. Every plan, Team and Enterprise included.</p>') +
      '</div><div class="dw-lights" aria-hidden="true"></div>';
    selector.insertBefore(band, selector.firstChild);

    // Credit tag on each billing option
    Array.prototype.forEach.call(selector.querySelectorAll("[data-billing-choice]"), function (button) {
      var monthly = button.getAttribute("data-billing-choice") === "monthly";
      button.appendChild(el("span", "dw-switch-tag", monthly ? "+₹5,000 AI" : "+₹30,000 AI"));
    });

    // Credit line in the selected-plan summary
    var figure = selector.querySelector(".plan-figure");
    var figureCredit = null;
    if (figure) {
      figureCredit = el("div", "dw-figure-credit");
      figure.appendChild(figureCredit);
    }

    // Credit block on every plan card
    var cardCredits = [];
    Array.prototype.forEach.call(selector.querySelectorAll(".plan-option"), function (option) {
      var block = el("span", "dw-card-credit");
      var anchor = option.querySelector(".plan-option-scope") || option.querySelector(".plan-option-head");
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(block, anchor.nextSibling);
      else option.appendChild(block);
      cardCredits.push(block);
    });

    // Line under the plan CTA
    var actions = selector.querySelector(".plan-actions");
    if (actions) {
      actions.appendChild(el("p", "dw-actions-note",
        audience === "firm"
          ? "Diwali offer: subscribe by 9 November to keep the extra AI credits."
          : "Diwali offer: subscribe inside the product by 9 November to keep the extra AI credits."));
    }

    function render() {
      var c = CREDIT[periodOf(selector)];
      if (figureCredit) {
        figureCredit.innerHTML = DIYA +
          '<span class="dw-figure-amount">+ ' + c.amount + " of AI credits</span>" +
          '<span class="dw-figure-meta">Diwali offer · ' + c.docs + " · " + c.tail + "</span>";
      }
      cardCredits.forEach(function (block) {
        block.innerHTML = '<span class="dw-card-amount">+ ' + c.amount + " of AI credits</span>" +
          '<span class="dw-card-meta">Diwali · until 9 Nov · carries over</span>';
      });
    }
    render();

    // The site's own script flips aria-pressed on the billing switch; follow it.
    if (window.MutationObserver) {
      new MutationObserver(render).observe(selector, { attributes: true, subtree: true, attributeFilter: ["aria-pressed"] });
    } else {
      selector.addEventListener("click", function () { setTimeout(render, 0); });
    }
  }

  /* ------------------------------------------------------------------
     3. /pricing: trial list and the plan table
     ------------------------------------------------------------------ */

  function adaptPricingPage() {
    if (path !== "/pricing") return;
    var trial = document.querySelector("#trial .trial-grid");
    if (trial && !trial.querySelector(".dw-trial-row")) {
      var row = el("div", "dw-trial-row",
        "<dt>Diwali offer</dt><dd>Plans bought by 11:59 pm IST on 9 November carry extra AI credits: ₹30,000 with 3 months, ₹5,000 with monthly. Unused credits carry over.</dd>");
      trial.insertBefore(row, trial.firstChild);
    }
    var table = document.querySelector("#plan-summary table");
    if (table && !table.hasAttribute("data-diwali")) {
      table.setAttribute("data-diwali", "");
      var headRow = table.querySelector("thead tr");
      if (headRow) {
        var th = el("th", "dw-col", "Diwali AI credits, monthly · 3 months");
        th.setAttribute("scope", "col");
        headRow.appendChild(th);
      }
      Array.prototype.forEach.call(table.querySelectorAll("tbody tr"), function (tr) {
        var td = el("td", "dw-col", "+₹5,000 · +₹30,000");
        td.setAttribute("data-label", "Diwali AI credits, monthly · 3 months");
        tr.appendChild(td);
      });
    }
  }


  /* ------------------------------------------------------------------
     4. Festive hero on /business, /business/restaurants, /business/sellers
        and /ca-firms. Those pages set the html class dw-night-page from
        their marked DIWALI-2026 head block (so the night sky paints with
        no flash); the lights, lanterns, sparkles and diyas are added here.
     ------------------------------------------------------------------ */

  var FESTIVE = "<div class=\"dw-festive\" aria-hidden=\"true\"> <svg class=\"dw-garland\" viewBox=\"0 0 1440 230\" preserveAspectRatio=\"xMidYMin slice\" aria-hidden=\"true\" focusable=\"false\"><path class=\"dw-wire dw-wire-back\" d=\"M-200 2 Q0 200 200 2\"></path><path class=\"dw-wire dw-wire-back\" d=\"M200 2 Q400 200 600 2\"></path><path class=\"dw-wire dw-wire-back\" d=\"M600 2 Q800 200 1000 2\"></path><path class=\"dw-wire dw-wire-back\" d=\"M1000 2 Q1200 200 1400 2\"></path><path class=\"dw-wire dw-wire-back\" d=\"M1400 2 Q1600 200 1800 2\"></path><g class=\"dw-bulb c3 p2\" style=\"animation-delay:1.07s\" transform=\"translate(-166.7 32.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c4 p0\" style=\"animation-delay:0.14s\" transform=\"translate(-133.3 57.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c5 p1\" style=\"animation-delay:0.97s\" transform=\"translate(-100.0 76.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c1 p2\" style=\"animation-delay:0.98s\" transform=\"translate(-66.7 90.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c2 p0\" style=\"animation-delay:1.33s\" transform=\"translate(-33.3 98.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c3 p1\" style=\"animation-delay:1.18s\" transform=\"translate(0.0 101.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c4 p2\" style=\"animation-delay:0.71s\" transform=\"translate(33.3 98.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c5 p0\" style=\"animation-delay:0.28s\" transform=\"translate(66.7 90.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c1 p1\" style=\"animation-delay:0.21s\" transform=\"translate(100.0 76.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c2 p2\" style=\"animation-delay:0.74s\" transform=\"translate(133.3 57.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c3 p0\" style=\"animation-delay:0.71s\" transform=\"translate(166.7 32.3)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c4 p1\" style=\"animation-delay:0.1s\" transform=\"translate(233.3 32.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c5 p2\" style=\"animation-delay:1.26s\" transform=\"translate(266.7 57.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c1 p0\" style=\"animation-delay:0.71s\" transform=\"translate(300.0 76.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c2 p1\" style=\"animation-delay:0.98s\" transform=\"translate(333.3 90.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c3 p2\" style=\"animation-delay:0.31s\" transform=\"translate(366.7 98.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c4 p0\" style=\"animation-delay:0.34s\" transform=\"translate(400.0 101.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c5 p1\" style=\"animation-delay:0.02s\" transform=\"translate(433.3 98.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c1 p2\" style=\"animation-delay:0.48s\" transform=\"translate(466.7 90.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c2 p0\" style=\"animation-delay:0.37s\" transform=\"translate(500.0 76.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c3 p1\" style=\"animation-delay:0.59s\" transform=\"translate(533.3 57.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c4 p2\" style=\"animation-delay:0.53s\" transform=\"translate(566.7 32.3)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c5 p0\" style=\"animation-delay:1.17s\" transform=\"translate(633.3 32.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c1 p1\" style=\"animation-delay:1.25s\" transform=\"translate(666.7 57.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c2 p2\" style=\"animation-delay:0.25s\" transform=\"translate(700.0 76.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c3 p0\" style=\"animation-delay:0.55s\" transform=\"translate(733.3 90.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c4 p1\" style=\"animation-delay:0.23s\" transform=\"translate(766.7 98.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c5 p2\" style=\"animation-delay:0.93s\" transform=\"translate(800.0 101.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c1 p0\" style=\"animation-delay:1.36s\" transform=\"translate(833.3 98.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c2 p1\" style=\"animation-delay:0.28s\" transform=\"translate(866.7 90.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c3 p2\" style=\"animation-delay:1.07s\" transform=\"translate(900.0 76.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c4 p0\" style=\"animation-delay:0.42s\" transform=\"translate(933.3 57.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c5 p1\" style=\"animation-delay:0.02s\" transform=\"translate(966.7 32.3)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c1 p2\" style=\"animation-delay:1.07s\" transform=\"translate(1033.3 32.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c2 p0\" style=\"animation-delay:0.48s\" transform=\"translate(1066.7 57.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c3 p1\" style=\"animation-delay:0.24s\" transform=\"translate(1100.0 76.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c4 p2\" style=\"animation-delay:0.61s\" transform=\"translate(1133.3 90.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c5 p0\" style=\"animation-delay:0.32s\" transform=\"translate(1166.7 98.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c1 p1\" style=\"animation-delay:0.57s\" transform=\"translate(1200.0 101.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c2 p2\" style=\"animation-delay:0.62s\" transform=\"translate(1233.3 98.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c3 p0\" style=\"animation-delay:0.59s\" transform=\"translate(1266.7 90.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c4 p1\" style=\"animation-delay:0.82s\" transform=\"translate(1300.0 76.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c5 p2\" style=\"animation-delay:0.4s\" transform=\"translate(1333.3 57.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c1 p0\" style=\"animation-delay:0.13s\" transform=\"translate(1366.7 32.3)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c2 p1\" style=\"animation-delay:0.12s\" transform=\"translate(1433.3 32.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c3 p2\" style=\"animation-delay:0.15s\" transform=\"translate(1466.7 57.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c4 p0\" style=\"animation-delay:0.73s\" transform=\"translate(1500.0 76.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c5 p1\" style=\"animation-delay:0.5s\" transform=\"translate(1533.3 90.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c1 p2\" style=\"animation-delay:1.13s\" transform=\"translate(1566.7 98.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c2 p0\" style=\"animation-delay:0.71s\" transform=\"translate(1600.0 101.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c3 p1\" style=\"animation-delay:0.99s\" transform=\"translate(1633.3 98.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c4 p2\" style=\"animation-delay:1.37s\" transform=\"translate(1666.7 90.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c5 p0\" style=\"animation-delay:0.09s\" transform=\"translate(1700.0 76.2)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c1 p1\" style=\"animation-delay:0.02s\" transform=\"translate(1733.3 57.0)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><g class=\"dw-bulb c2 p2\" style=\"animation-delay:0.2s\" transform=\"translate(1766.7 32.3)\"><circle class=\"dw-glow\" r=\"11.4\" cy=\"6.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"6.8\" rx=\"3.4\" ry=\"4.4\"></ellipse></g><path class=\"dw-wire\" d=\"M-40 6 Q160 124 360 6\"></path><path class=\"dw-wire\" d=\"M360 6 Q560 124 760 6\"></path><path class=\"dw-wire\" d=\"M760 6 Q960 124 1160 6\"></path><path class=\"dw-wire\" d=\"M1160 6 Q1340 124 1520 6\"></path><g class=\"dw-bulb c1 p0\" style=\"animation-delay:0.32s\" transform=\"translate(-9.2 22.8)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c2 p1\" style=\"animation-delay:1.35s\" transform=\"translate(21.5 36.7)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c3 p2\" style=\"animation-delay:0.18s\" transform=\"translate(52.3 47.9)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c4 p0\" style=\"animation-delay:0.99s\" transform=\"translate(83.1 56.3)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c5 p1\" style=\"animation-delay:0.12s\" transform=\"translate(113.8 61.9)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c1 p2\" style=\"animation-delay:0.35s\" transform=\"translate(144.6 64.7)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c2 p0\" style=\"animation-delay:1.4s\" transform=\"translate(175.4 64.7)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c3 p1\" style=\"animation-delay:0.29s\" transform=\"translate(206.2 61.9)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c4 p2\" style=\"animation-delay:0.9s\" transform=\"translate(236.9 56.3)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c5 p0\" style=\"animation-delay:0.64s\" transform=\"translate(267.7 47.9)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c1 p1\" style=\"animation-delay:0.63s\" transform=\"translate(298.5 36.7)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c2 p2\" style=\"animation-delay:0.69s\" transform=\"translate(329.2 22.8)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c3 p0\" style=\"animation-delay:0.27s\" transform=\"translate(390.8 22.8)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c4 p1\" style=\"animation-delay:1.16s\" transform=\"translate(421.5 36.7)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c5 p2\" style=\"animation-delay:0.13s\" transform=\"translate(452.3 47.9)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c1 p0\" style=\"animation-delay:0.33s\" transform=\"translate(483.1 56.3)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c2 p1\" style=\"animation-delay:0.03s\" transform=\"translate(513.8 61.9)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c3 p2\" style=\"animation-delay:0.37s\" transform=\"translate(544.6 64.7)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c4 p0\" style=\"animation-delay:0.57s\" transform=\"translate(575.4 64.7)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c5 p1\" style=\"animation-delay:1.26s\" transform=\"translate(606.2 61.9)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c1 p2\" style=\"animation-delay:0.53s\" transform=\"translate(636.9 56.3)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c2 p0\" style=\"animation-delay:0.16s\" transform=\"translate(667.7 47.9)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c3 p1\" style=\"animation-delay:0.36s\" transform=\"translate(698.5 36.7)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c4 p2\" style=\"animation-delay:1.39s\" transform=\"translate(729.2 22.8)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c5 p0\" style=\"animation-delay:0.09s\" transform=\"translate(790.8 22.8)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c1 p1\" style=\"animation-delay:0.87s\" transform=\"translate(821.5 36.7)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c2 p2\" style=\"animation-delay:0.53s\" transform=\"translate(852.3 47.9)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c3 p0\" style=\"animation-delay:0.93s\" transform=\"translate(883.1 56.3)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c4 p1\" style=\"animation-delay:0.47s\" transform=\"translate(913.8 61.9)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c5 p2\" style=\"animation-delay:0.97s\" transform=\"translate(944.6 64.7)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c1 p0\" style=\"animation-delay:0.7s\" transform=\"translate(975.4 64.7)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c2 p1\" style=\"animation-delay:0.91s\" transform=\"translate(1006.2 61.9)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c3 p2\" style=\"animation-delay:1.26s\" transform=\"translate(1036.9 56.3)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c4 p0\" style=\"animation-delay:0.81s\" transform=\"translate(1067.7 47.9)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c5 p1\" style=\"animation-delay:0.2s\" transform=\"translate(1098.5 36.7)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c1 p2\" style=\"animation-delay:0.09s\" transform=\"translate(1129.2 22.8)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c2 p0\" style=\"animation-delay:1.32s\" transform=\"translate(1190.0 24.0)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c3 p1\" style=\"animation-delay:0.68s\" transform=\"translate(1220.0 38.8)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c4 p2\" style=\"animation-delay:0.27s\" transform=\"translate(1250.0 50.2)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c5 p0\" style=\"animation-delay:1.32s\" transform=\"translate(1280.0 58.4)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c1 p1\" style=\"animation-delay:0.81s\" transform=\"translate(1310.0 63.4)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c2 p2\" style=\"animation-delay:1.02s\" transform=\"translate(1340.0 65.0)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c3 p0\" style=\"animation-delay:1.23s\" transform=\"translate(1370.0 63.4)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c4 p1\" style=\"animation-delay:0.4s\" transform=\"translate(1400.0 58.4)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c5 p2\" style=\"animation-delay:0.5s\" transform=\"translate(1430.0 50.2)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c1 p0\" style=\"animation-delay:1.23s\" transform=\"translate(1460.0 38.8)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g><g class=\"dw-bulb c2 p1\" style=\"animation-delay:0.19s\" transform=\"translate(1490.0 24.0)\"><circle class=\"dw-glow\" r=\"14.0\" cy=\"7.4\"></circle><rect x=\"-2.2\" y=\"-1\" width=\"4.4\" height=\"4\" rx=\"1\" class=\"dw-cap\"></rect><ellipse class=\"dw-lamp\" cy=\"7.8\" rx=\"4.2\" ry=\"5.4\"></ellipse></g></svg> <span class=\"dw-lantern dw-lantern-l\"><svg viewBox=\"0 0 80 230\" aria-hidden=\"true\" focusable=\"false\"><line x1=\"40\" y1=\"0\" x2=\"40\" y2=\"62\" class=\"dw-l-string\"></line><g class=\"dw-l-body\"><circle cx=\"40\" cy=\"118\" r=\"44\" class=\"dw-l-halo\"></circle><polygon points=\"40,62 74,96 64,146 16,146 6,96\" class=\"dw-l-shell\"></polygon><polygon points=\"40,74 62,98 55,136 25,136 18,98\" class=\"dw-l-core\"></polygon><polygon points=\"40,62 74,96 6,96\" class=\"dw-l-top\"></polygon><rect x=\"30\" y=\"146\" width=\"20\" height=\"8\" rx=\"2\" class=\"dw-l-band\"></rect><path d=\"M32 154 L28 212 M36 154 L35 220 M40 154 L40 224 M44 154 L45 220 M48 154 L52 212\" class=\"dw-l-tassel\"></path></g></svg></span> <span class=\"dw-lantern dw-lantern-r\"><svg viewBox=\"0 0 80 230\" aria-hidden=\"true\" focusable=\"false\"><line x1=\"40\" y1=\"0\" x2=\"40\" y2=\"62\" class=\"dw-l-string\"></line><g class=\"dw-l-body\"><circle cx=\"40\" cy=\"118\" r=\"44\" class=\"dw-l-halo\"></circle><polygon points=\"40,62 74,96 64,146 16,146 6,96\" class=\"dw-l-shell\"></polygon><polygon points=\"40,74 62,98 55,136 25,136 18,98\" class=\"dw-l-core\"></polygon><polygon points=\"40,62 74,96 6,96\" class=\"dw-l-top\"></polygon><rect x=\"30\" y=\"146\" width=\"20\" height=\"8\" rx=\"2\" class=\"dw-l-band\"></rect><path d=\"M32 154 L28 212 M36 154 L35 220 M40 154 L40 224 M44 154 L45 220 M48 154 L52 212\" class=\"dw-l-tassel\"></path></g></svg></span> <span class=\"dw-spark\" style=\"left:39.1%;top:58.7%;animation-delay:2.98s;animation-duration:3.17s;--s:1\"></span><span class=\"dw-spark\" style=\"left:2.3%;top:79.2%;animation-delay:0.84s;animation-duration:4.33s;--s:0.6\"></span><span class=\"dw-spark\" style=\"left:86.8%;top:81.8%;animation-delay:3.23s;animation-duration:4.20s;--s:0.8\"></span><span class=\"dw-spark\" style=\"left:19.1%;top:89.6%;animation-delay:1.77s;animation-duration:2.58s;--s:0.8\"></span><span class=\"dw-spark\" style=\"left:49.7%;top:50.9%;animation-delay:0.62s;animation-duration:2.67s;--s:1.3\"></span><span class=\"dw-spark\" style=\"left:64.2%;top:70.1%;animation-delay:2.06s;animation-duration:2.60s;--s:1.3\"></span><span class=\"dw-spark\" style=\"left:56.1%;top:77.7%;animation-delay:1.82s;animation-duration:2.51s;--s:0.6\"></span><span class=\"dw-spark\" style=\"left:44.8%;top:22.4%;animation-delay:2.90s;animation-duration:3.96s;--s:0.6\"></span><span class=\"dw-spark\" style=\"left:64.9%;top:78.7%;animation-delay:2.11s;animation-duration:4.55s;--s:0.8\"></span><span class=\"dw-spark\" style=\"left:50.1%;top:39.3%;animation-delay:1.54s;animation-duration:3.54s;--s:0.8\"></span><span class=\"dw-spark\" style=\"left:2.6%;top:61.8%;animation-delay:3.64s;animation-duration:4.04s;--s:1.3\"></span><span class=\"dw-spark\" style=\"left:23.5%;top:37.1%;animation-delay:2.19s;animation-duration:4.55s;--s:1\"></span><span class=\"dw-spark\" style=\"left:79.5%;top:71.8%;animation-delay:1.28s;animation-duration:3.06s;--s:1\"></span><span class=\"dw-spark\" style=\"left:77.2%;top:37.1%;animation-delay:3.38s;animation-duration:2.83s;--s:1\"></span><span class=\"dw-spark\" style=\"left:38.3%;top:59.6%;animation-delay:3.67s;animation-duration:2.85s;--s:1.3\"></span><span class=\"dw-spark\" style=\"left:60.9%;top:79.7%;animation-delay:2.74s;animation-duration:4.46s;--s:1\"></span><span class=\"dw-spark\" style=\"left:80.8%;top:61.2%;animation-delay:1.45s;animation-duration:3.34s;--s:1.3\"></span><span class=\"dw-spark\" style=\"left:81.0%;top:53.6%;animation-delay:0.33s;animation-duration:2.76s;--s:1.3\"></span><span class=\"dw-spark\" style=\"left:72.4%;top:35.1%;animation-delay:1.68s;animation-duration:2.66s;--s:1\"></span><span class=\"dw-spark\" style=\"left:96.7%;top:35.4%;animation-delay:3.30s;animation-duration:2.99s;--s:1.3\"></span><span class=\"dw-spark\" style=\"left:25.5%;top:33.2%;animation-delay:0.99s;animation-duration:3.51s;--s:1.3\"></span><span class=\"dw-spark\" style=\"left:26.0%;top:77.4%;animation-delay:2.39s;animation-duration:4.23s;--s:1\"></span><span class=\"dw-spark\" style=\"left:49.7%;top:22.2%;animation-delay:0.45s;animation-duration:2.59s;--s:0.8\"></span><span class=\"dw-spark\" style=\"left:76.9%;top:91.5%;animation-delay:3.68s;animation-duration:4.13s;--s:0.8\"></span><span class=\"dw-spark\" style=\"left:4.1%;top:28.9%;animation-delay:1.06s;animation-duration:2.61s;--s:1.3\"></span><span class=\"dw-spark\" style=\"left:85.4%;top:84.6%;animation-delay:3.70s;animation-duration:2.60s;--s:1\"></span><span class=\"dw-spark\" style=\"left:85.0%;top:64.9%;animation-delay:1.28s;animation-duration:2.49s;--s:0.6\"></span><span class=\"dw-spark\" style=\"left:84.5%;top:65.0%;animation-delay:1.46s;animation-duration:4.22s;--s:0.8\"></span><span class=\"dw-spark\" style=\"left:71.6%;top:60.8%;animation-delay:1.28s;animation-duration:3.05s;--s:1\"></span><span class=\"dw-spark\" style=\"left:94.9%;top:19.2%;animation-delay:3.60s;animation-duration:4.42s;--s:1\"></span><span class=\"dw-spark\" style=\"left:43.7%;top:26.3%;animation-delay:3.57s;animation-duration:2.73s;--s:0.6\"></span><span class=\"dw-spark\" style=\"left:11.6%;top:31.4%;animation-delay:1.17s;animation-duration:2.79s;--s:0.8\"></span><span class=\"dw-spark\" style=\"left:12.5%;top:18.0%;animation-delay:2.22s;animation-duration:4.02s;--s:0.8\"></span><span class=\"dw-spark\" style=\"left:55.7%;top:39.5%;animation-delay:3.53s;animation-duration:4.02s;--s:1.3\"></span> </div>";
  var DIYAS = "<div class=\"dw-diyas\" aria-hidden=\"true\"><svg class=\"dw-diya-svg s\" viewBox=\"0 0 64 56\" aria-hidden=\"true\" focusable=\"false\"><ellipse cx=\"32\" cy=\"22\" rx=\"10\" ry=\"14\" class=\"dw-flame-glow\"></ellipse><path class=\"dw-flame\" d=\"M32 4c4.6 6 7 10.5 7 14.2a7 7 0 0 1-14 0C25 14.5 27.4 10 32 4z\"></path><path class=\"dw-flame-core\" d=\"M32 11c1.8 2.6 2.7 4.4 2.7 5.8a2.7 2.7 0 0 1-5.4 0c0-1.4.9-3.2 2.7-5.8z\"></path><path class=\"dw-bowl\" d=\"M4 30h56c-1.8 11-12 19-28 19S5.8 41 4 30z\"></path><path class=\"dw-bowl-rim\" d=\"M4 30h56\"></path><path class=\"dw-bowl-dots\" d=\"M16 38h.1M24 40.5h.1M32 41.3h.1M40 40.5h.1M48 38h.1\"></path></svg><svg class=\"dw-diya-svg \" viewBox=\"0 0 64 56\" aria-hidden=\"true\" focusable=\"false\"><ellipse cx=\"32\" cy=\"22\" rx=\"10\" ry=\"14\" class=\"dw-flame-glow\"></ellipse><path class=\"dw-flame\" d=\"M32 4c4.6 6 7 10.5 7 14.2a7 7 0 0 1-14 0C25 14.5 27.4 10 32 4z\"></path><path class=\"dw-flame-core\" d=\"M32 11c1.8 2.6 2.7 4.4 2.7 5.8a2.7 2.7 0 0 1-5.4 0c0-1.4.9-3.2 2.7-5.8z\"></path><path class=\"dw-bowl\" d=\"M4 30h56c-1.8 11-12 19-28 19S5.8 41 4 30z\"></path><path class=\"dw-bowl-rim\" d=\"M4 30h56\"></path><path class=\"dw-bowl-dots\" d=\"M16 38h.1M24 40.5h.1M32 41.3h.1M40 40.5h.1M48 38h.1\"></path></svg><svg class=\"dw-diya-svg s\" viewBox=\"0 0 64 56\" aria-hidden=\"true\" focusable=\"false\"><ellipse cx=\"32\" cy=\"22\" rx=\"10\" ry=\"14\" class=\"dw-flame-glow\"></ellipse><path class=\"dw-flame\" d=\"M32 4c4.6 6 7 10.5 7 14.2a7 7 0 0 1-14 0C25 14.5 27.4 10 32 4z\"></path><path class=\"dw-flame-core\" d=\"M32 11c1.8 2.6 2.7 4.4 2.7 5.8a2.7 2.7 0 0 1-5.4 0c0-1.4.9-3.2 2.7-5.8z\"></path><path class=\"dw-bowl\" d=\"M4 30h56c-1.8 11-12 19-28 19S5.8 41 4 30z\"></path><path class=\"dw-bowl-rim\" d=\"M4 30h56\"></path><path class=\"dw-bowl-dots\" d=\"M16 38h.1M24 40.5h.1M32 41.3h.1M40 40.5h.1M48 38h.1\"></path></svg></div>";

  function festiveHero() {
    if (!document.documentElement.classList.contains("dw-night-page")) return;
    var hero = document.querySelector("section.hero");
    if (!hero || hero.querySelector(".dw-festive")) return;
    hero.insertAdjacentHTML("afterbegin", FESTIVE);
    var status = hero.querySelector(".hero-copy .status-line");
    if (status) status.insertAdjacentHTML("beforebegin", DIYAS);
  }

  function start() {
    try { mountBanner(); } catch (e) {}
    try { Array.prototype.forEach.call(document.querySelectorAll("[data-plan-selector]"), adaptSelector); } catch (e) {}
    try { adaptPricingPage(); } catch (e) {}
    try { festiveHero(); } catch (e) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
