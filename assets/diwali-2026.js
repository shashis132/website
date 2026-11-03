/*
 * GeniusCFO · Diwali 2026 offer (temporary)
 *
 * Adds the Diwali banner to every page and the Diwali AI credits to every
 * plan selector, the /pricing trial list and the /pricing plan table.
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

  function start() {
    try { mountBanner(); } catch (e) {}
    try { Array.prototype.forEach.call(document.querySelectorAll("[data-plan-selector]"), adaptSelector); } catch (e) {}
    try { adaptPricingPage(); } catch (e) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
