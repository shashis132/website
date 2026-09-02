(() => {
  "use strict";

  document.documentElement.classList.add("js");

  /* --------------------------------------------------------------------
     Lead capture endpoint.

     The Google Apps Script web app writing to the leads sheet, and the only
     place that sheet is configured. Redeploying the script mints a new
     /s/…/exec id, so this constant has to be updated whenever it is
     redeployed — see apps-script/Code.gs and VERCEL-SETUP.md.

     Two POSTs per lead: step 1 on contact submit, step 2 on triage submit,
     both carrying the same phone and email so the sheet merges them into
     one row. Sent with mode:"no-cors" — the opaque response is expected and
     ignored, so a failed write is silent and only a real test submission
     proves the sheet is receiving.

     If this is ever blanked, nothing is posted, the form still advances and
     each submit logs a console warning.
     -------------------------------------------------------------------- */
  const LEAD_ENDPOINT = "https://script.google.com/macros/s/AKfycbyggslRlgh1LopVaK_88gms4MgePKgBTfChm1kl2ClIRTdmKVGZV5YsahpAdbjHPAp-Aw/exec";
  const IS_LOCAL_PREVIEW = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

  /* Cal.com inline booking. The event type namespace comes from Cal.com's
     embed generator for https://cal.com/geniuscfo/30min. */
  const CAL_ORIGIN = "https://app.cal.com";
  const CAL_LINK = "geniuscfo/30min";
  const CAL_NAMESPACE = "30min";

  const TRACKING_KEYS = [
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    "gclid", "fbclid", "msclkid", "li_fat_id"
  ];
  const current = new URL(window.location.href);
  const tracking = new URLSearchParams();

  if (current.searchParams.get("pdf") === "1") {
    document.documentElement.classList.add("pdf-capture");
  }

  TRACKING_KEYS.forEach((key) => {
    const value = current.searchParams.get(key);
    if (value) tracking.set(key, value);
  });

  /* Persist attribution for the session so a lead submitted three pages
     later still carries the campaign it arrived on. */
  const storedTracking = () => {
    try {
      return JSON.parse(window.sessionStorage.getItem("gc_utm") || "{}");
    } catch (error) {
      return {};
    }
  };

  (() => {
    try {
      const stored = storedTracking();
      let changed = false;
      tracking.forEach((value, key) => {
        if (!stored[key]) { stored[key] = value; changed = true; }
      });
      if (document.referrer && !stored.landing_referrer) {
        stored.landing_referrer = document.referrer;
        changed = true;
      }
      if (changed) window.sessionStorage.setItem("gc_utm", JSON.stringify(stored));
    } catch (error) { /* private mode — attribution is best-effort */ }
  })();

  const audienceFromPath = () => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("ca-firms")) return "ca-firms";
    if (path.includes("business")) return "business";
    if (path.includes("pricing")) {
      return current.searchParams.get("audience") === "ca-firms" ? "ca-firms" : "business";
    }
    return "business";
  };

  const audience = audienceFromPath();
  document.documentElement.dataset.audience = audience;

  const preserveTracking = (link) => {
    const raw = link.getAttribute("href");
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return;
    const url = new URL(raw, window.location.href);
    if (url.origin !== window.location.origin && !url.hostname.endsWith("geniuscfo.ai")) return;
    tracking.forEach((value, key) => url.searchParams.set(key, value));
    link.href = url.pathname + url.search + url.hash;
  };

  document.querySelectorAll("a[data-preserve-query]").forEach(preserveTracking);

  const pushDataLayer = (event, params) => {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event }, params || {}));
    } catch (error) { /* analytics is optional */ }
  };

  /* First-party cookie read. Used only to hand the ad-click and browser ids
     that the Meta pixel and LinkedIn Insight Tag stored on geniuscfo.ai to
     the Cal.com booking frame, which lives on another origin. */
  const readCookie = (name) => {
    try {
      const pattern = new RegExp("(?:^|; )" + name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&") + "=([^;]*)");
      const match = document.cookie.match(pattern);
      return match ? decodeURIComponent(match[1]) : "";
    } catch (error) {
      return "";
    }
  };

  /* ====================================================================
     Header, menu, access strip
     ==================================================================== */

  const menuButton = document.querySelector("[data-menu-button]");
  const menu = document.querySelector("[data-mobile-menu]");
  if (menuButton && menu) {
    menuButton.addEventListener("click", () => {
      const open = menuButton.getAttribute("aria-expanded") === "true";
      menuButton.setAttribute("aria-expanded", String(!open));
      menu.hidden = open;
    });
    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        menuButton.setAttribute("aria-expanded", "false");
        menu.hidden = true;
      });
    });
  }

  document.querySelectorAll("[data-dismiss-strip]").forEach((button) => {
    button.addEventListener("click", () => {
      const strip = button.closest("[data-access-strip]");
      if (strip) strip.hidden = true;
    });
  });

  /* ====================================================================
     Plan selector
     One control per audience block. Plan data lives on the option labels
     as data-* attributes so the markup stays the single source of truth
     and the page still reads correctly with JavaScript disabled.
     ==================================================================== */

  const selectedPlans = {};

  const syncPlanToForms = () => {
    const parts = Object.keys(selectedPlans)
      .map((key) => `${key}:${selectedPlans[key].id}/${selectedPlans[key].period}`)
      .join(" ");
    document.querySelectorAll('[name="interested_plan"]').forEach((input) => {
      input.value = parts;
    });
  };

  /* A pricing CTA carries ?plan=…&billing=… to the landing page. Read it back
     so the destination page opens on the plan the visitor actually chose and
     the lead form reports that plan rather than resetting to the first one. */
  const deepLinkPlan = (current.searchParams.get("plan") || "").trim();
  const deepLinkBilling = (current.searchParams.get("billing") || "").trim().toLowerCase();

  document.querySelectorAll("[data-plan-selector]").forEach((selector) => {
    const group = selector.dataset.planSelector;
    const options = Array.from(selector.querySelectorAll(".plan-option"));
    const billingButtons = Array.from(selector.querySelectorAll("[data-billing-choice]"));
    const figureLabel = selector.querySelector("[data-figure-label]");
    const figureAmount = selector.querySelector("[data-figure-amount]");
    const figureMeta = selector.querySelector("[data-figure-meta]");
    const figureTotal = selector.querySelector("[data-figure-total]");
    const cta = selector.querySelector("[data-plan-cta]");
    const ctaBase = cta ? cta.getAttribute("href") : null;

    if (!options.length) return;

    let period = selector.dataset.planDefaultPeriod === "monthly" ? "monthly" : "quarterly";
    if (deepLinkBilling === "monthly") period = "monthly";
    else if (deepLinkBilling === "3-month" || deepLinkBilling === "quarterly") period = "quarterly";

    /* The selected-plan figure is rewritten by the billing switch and by plan
       changes; announce it politely so it is not a silent visual update. */
    const figure = selector.querySelector(".plan-figure");
    if (figure && !figure.hasAttribute("aria-live")) {
      figure.setAttribute("aria-live", "polite");
      figure.setAttribute("aria-atomic", "true");
    }

    const dataFor = (option, key) => option.dataset[period + key] || "";

    const render = () => {
      billingButtons.forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.billingChoice === period));
      });

      options.forEach((option) => {
        const input = option.querySelector("input");
        const chosen = !!(input && input.checked);
        option.classList.toggle("is-selected", chosen);

        const priceSlot = option.querySelector("[data-price-slot]");
        const priceNote = option.querySelector("[data-price-note]");
        if (priceSlot) priceSlot.textContent = dataFor(option, "Display");
        if (priceNote) priceNote.textContent = dataFor(option, "Note");

        if (!chosen) return;

        const name = option.dataset.planName || "";
        const headline = period === "quarterly"
          ? (option.dataset.quarterlyMonthly || dataFor(option, "Display"))
          : dataFor(option, "Display");
        const unit = period === "quarterly" ? "/month equivalent" : "/month";

        if (figureLabel) {
          figureLabel.textContent = `SELECTED · ${name.toUpperCase()} · ${period === "quarterly" ? "3 MONTHS" : "MONTHLY"}`;
        }
        if (figureAmount) {
          figureAmount.textContent = headline;
          const span = document.createElement("span");
          span.textContent = ` ${unit}`;
          figureAmount.appendChild(span);
        }
        if (figureMeta) figureMeta.textContent = dataFor(option, "Copy");
        if (figureTotal) figureTotal.textContent = `${dataFor(option, "Total")} TOTAL, INCLUDING 18% GST`;

        selectedPlans[group] = { id: option.dataset.planId || "", period };

        if (cta && ctaBase) {
          const url = new URL(ctaBase, window.location.href);
          url.searchParams.set("plan", option.dataset.planId || "");
          url.searchParams.set("billing", period === "quarterly" ? "3-month" : "monthly");
          tracking.forEach((value, key) => url.searchParams.set(key, value));
          cta.href = url.pathname + url.search + url.hash;
        }
      });

      syncPlanToForms();
    };

    options.forEach((option) => {
      const input = option.querySelector("input");
      if (!input) return;
      input.addEventListener("change", () => {
        if (input.checked) {
          pushDataLayer("pricing_plan_selected", {
            plan: option.dataset.planId || "",
            plan_group: group,
            billing_period: period === "quarterly" ? "3-month" : "monthly"
          });
        }
        render();
      });
    });

    billingButtons.forEach((button) => {
      button.addEventListener("click", () => {
        period = button.dataset.billingChoice === "monthly" ? "monthly" : "quarterly";
        pushDataLayer("pricing_billing_toggled", {
          plan_group: group,
          billing_period: period === "quarterly" ? "3-month" : "monthly"
        });
        render();
      });
    });

    /* Selection order: ?plan= from a pricing CTA, then whatever the markup
       pre-checks, then the first option. */
    const deepLinkOption = deepLinkPlan
      ? options.find((option) => option.dataset.planId === deepLinkPlan)
      : null;

    if (deepLinkOption) {
      options.forEach((option) => {
        const i = option.querySelector("input");
        if (i) i.checked = option === deepLinkOption;
      });
    } else if (!options.some((option) => { const i = option.querySelector("input"); return i && i.checked; })) {
      const first = options[0].querySelector("input");
      if (first) first.checked = true;
    }

    render();
  });

  /* ====================================================================
     Multi-step lead form
     Step 1 — contact and role.  Step 2 — triage, branched by role.
     Step 3 — Cal.com inline booking. Each of steps 1 and 2 POSTs to the
     sheet. Cal.com's own GTM app sends bookingSuccessfulV2 to the web
     container inside the booking frame, where the GA4 tag maps it to
     `generate_lead`; the server container then raises the Meta Lead and
     LinkedIn lead conversions. The parent page never pushes generate_lead,
     so a booking is counted exactly once.
     ==================================================================== */

  const FIRM_ROLES = ["ca_firm", "cfo_firm"];

  /* Cal.com's generated bootstrap is queue-safe: the API calls below can be
     registered before embed.js finishes downloading. It runs only when Step 3
     opens, so the booking app does not slow the initial landing-page load. */
  const ensureCalApi = () => {
    ((C, A, L) => {
      const enqueue = (api, args) => { api.q.push(args); };
      const doc = C.document;
      C.Cal = C.Cal || function calQueue() {
        const cal = C.Cal;
        const args = arguments;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          doc.head.appendChild(doc.createElement("script")).src = A;
          cal.loaded = true;
        }
        if (args[0] === L) {
          const api = function namespacedQueue() { enqueue(api, arguments); };
          const namespace = args[1];
          api.q = api.q || [];
          if (typeof namespace === "string") {
            cal.ns[namespace] = cal.ns[namespace] || api;
            enqueue(cal.ns[namespace], args);
            enqueue(cal, ["initNamespace", namespace]);
          } else {
            enqueue(cal, args);
          }
          return;
        }
        enqueue(cal, args);
      };
    })(window, `${CAL_ORIGIN}/embed/embed.js`, "init");

    window.Cal("init", CAL_NAMESPACE, { origin: CAL_ORIGIN });
    window.Cal.config = window.Cal.config || {};
    window.Cal.config.forwardQueryParams = true;
    return window.Cal.ns[CAL_NAMESPACE];
  };

  document.querySelectorAll("[data-lead-form]").forEach((root) => {
    const track = root.dataset.leadTrack === "practice" ? "practice" : "business";
    const steps = {
      1: root.querySelector('[data-lead-step="1"]'),
      2: root.querySelector('[data-lead-step="2"]'),
      3: root.querySelector('[data-lead-step="3"]')
    };
    const progress = Array.from(root.querySelectorAll("[data-lead-progress] span"));
    const turnoverField = root.querySelector("[data-turnover-field]");
    const bookingFrame = root.querySelector("[data-cal-inline]");
    const bookingLoading = root.querySelector("[data-booking-loading]");
    const bookingStatus = root.querySelector("[data-booking-status]");
    const branches = {
      owner: root.querySelector('[data-lead-branch="owner"]'),
      firm: root.querySelector('[data-lead-branch="firm"]')
    };

    const state = {
      step: 1,
      role: track === "practice" ? "ca_firm" : "business_owner",
      challenge: "",
      tool: "",
      clientTool: "",
      clientCount: "",
      bookingShown: false
    };

    const field = (name) => root.querySelector(`[name="${name}"]`);
    const value = (name) => {
      const input = field(name);
      return input ? String(input.value || "").trim() : "";
    };

    /* Errors are injected after submit, so they need role="alert" in place
       from the start to be announced, and the field they describe needs to be
       marked invalid and pointed at the message. */
    root.querySelectorAll("[data-lead-error]").forEach((node) => {
      if (!node.getAttribute("role")) node.setAttribute("role", "alert");
      if (!node.id) node.id = `lead-error-${node.dataset.leadError}-${Math.random().toString(36).slice(2, 7)}`;
    });

    const markField = (key, message) => {
      const input = root.querySelector(`[name="${key}"]`);
      const node = root.querySelector(`[data-lead-error="${key}"]`);
      if (!input || !node) return;
      if (message) {
        input.setAttribute("aria-invalid", "true");
        const described = (input.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
        if (described.indexOf(node.id) === -1) described.push(node.id);
        input.setAttribute("aria-describedby", described.join(" "));
      } else {
        input.removeAttribute("aria-invalid");
        const described = (input.getAttribute("aria-describedby") || "")
          .split(/\s+/).filter((id) => id && id !== node.id);
        if (described.length) input.setAttribute("aria-describedby", described.join(" "));
        else input.removeAttribute("aria-describedby");
      }
    };

    const showError = (key, message) => {
      const node = root.querySelector(`[data-lead-error="${key}"]`);
      if (!node) return;
      node.textContent = message || "";
      node.hidden = !message;
      markField(key, message);
    };

    const clearErrors = () => {
      root.querySelectorAll("[data-lead-error]").forEach((node) => {
        node.textContent = "";
        node.hidden = true;
        markField(node.dataset.leadError, "");
      });
    };

    const setBookingStatus = (message, confirmed) => {
      if (!bookingStatus) return;
      bookingStatus.textContent = message;
      bookingStatus.classList.toggle("is-confirmed", !!confirmed);
    };

    const setBookingLoadError = () => {
      if (!bookingLoading) return;
      bookingLoading.hidden = false;
      bookingLoading.textContent = "The booking calendar could not load here. Open it in a new tab below.";
    };

    const showCalBookingSuccess = (calEvent) => {
      const detail = calEvent && calEvent.detail ? calEvent.detail : {};
      if (detail.namespace && detail.namespace !== CAL_NAMESPACE) return;
      if (state.bookingShown) return;
      state.bookingShown = true;
      setBookingStatus("Your demo is booked. Check your email for the Cal.com confirmation.", true);
    };

    const initBooking = () => {
      if (!bookingFrame || bookingFrame.dataset.calActive === "true") return;
      bookingFrame.dataset.calActive = "true";

      const cal = ensureCalApi();
      const markReady = () => {
        if (bookingLoading) bookingLoading.hidden = true;
      };

      cal("on", { action: "linkReady", callback: markReady });
      cal("on", { action: "bookerReady", callback: markReady });
      cal("on", { action: "linkFailed", callback: setBookingLoadError });
      cal("on", { action: "bookingSuccessfulV2", callback: showCalBookingSuccess });

      /* Every config key becomes a query parameter of the embedded booking
         page, where the same GTM container runs. `name` and `email` prefill
         Cal's own form from Step 1; the click and browser ids let the
         server-side Meta and LinkedIn tags attribute the booking to the ad
         click that landed on geniuscfo.ai, which the third-party frame
         cannot see on its own. Nothing here is a conversion event. */
      const bookingConfig = { layout: "month_view", useSlotsViewOnSmallScreen: "true" };
      const prefillName = value("name");
      const prefillEmail = value("email");
      const linkedInClickId = tracking.get("li_fat_id") || readCookie("li_fat_id");
      const metaClickId = readCookie("_fbc");
      const metaBrowserId = readCookie("_fbp");
      if (prefillName) bookingConfig.name = prefillName;
      if (prefillEmail) bookingConfig.email = prefillEmail;
      if (linkedInClickId) bookingConfig.li_fat_id = linkedInClickId;
      if (metaClickId) bookingConfig.fbc = metaClickId;
      if (metaBrowserId) bookingConfig.fbp = metaBrowserId;

      cal("inline", {
        elementOrSelector: bookingFrame,
        config: bookingConfig,
        calLink: CAL_LINK
      });
      cal("ui", {
        cssVarsPerTheme: {
          light: { "cal-brand": "#00674d" },
          dark: { "cal-brand": "#00c896" }
        },
        hideEventTypeDetails: false,
        layout: "month_view"
      });

      const embedScript = document.querySelector(`script[src="${CAL_ORIGIN}/embed/embed.js"]`);
      if (embedScript && embedScript.dataset.bookingErrorBound !== "true") {
        embedScript.dataset.bookingErrorBound = "true";
        embedScript.addEventListener("error", setBookingLoadError, { once: true });
      }
    };

    const setStep = (next) => {
      state.step = next;
      document.documentElement.classList.toggle("lead-booking-visible", next === 3);
      Object.keys(steps).forEach((key) => {
        if (steps[key]) steps[key].hidden = Number(key) !== next;
      });
      progress.forEach((node, index) => {
        if (index + 1 === next) node.setAttribute("aria-current", "step");
        else node.removeAttribute("aria-current");
      });
      const heading = steps[next] ? steps[next].querySelector("h3") : null;
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
      if (next === 3) initBooking();
    };

    const isFirm = () => FIRM_ROLES.indexOf(state.role) > -1;

    const syncRole = () => {
      if (turnoverField) turnoverField.hidden = isFirm();
      if (branches.owner) branches.owner.hidden = isFirm();
      if (branches.firm) branches.firm.hidden = !isFirm();
      const roleInput = field("role");
      if (roleInput) roleInput.value = state.role;
    };

    /* Chip groups write into `state` and mirror to a hidden input. */
    root.querySelectorAll("[data-chip-group]").forEach((group) => {
      const key = group.dataset.chipGroup;
      const chips = Array.from(group.querySelectorAll(".chip"));
      chips.forEach((chip) => {
        chip.addEventListener("click", () => {
          chips.forEach((other) => other.setAttribute("aria-pressed", String(other === chip)));
          state[key] = chip.dataset.chipValue || "";
          const mirror = field(key === "role" ? "role" : key);
          if (mirror) mirror.value = state[key];
          if (key === "role") syncRole();
          showError(key, "");
        });
      });
      const preset = chips.find((chip) => chip.dataset.chipValue === state[key]);
      if (preset) preset.setAttribute("aria-pressed", "true");
    });

    syncRole();

    const send = (extra) => {
      const payload = Object.assign({
        name: value("name"),
        phone: value("phone"),
        email: value("email"),
        company: value("company"),
        turnover: isFirm() ? "" : value("turnover"),
        role: state.role,
        track: track,
        whatsapp_optin: field("consent") && field("consent").checked ? "yes" : "no",
        whatsapp_consent_source: window.location.href,
        whatsapp_consent_timestamp: new Date().toISOString(),
        interested_plan: value("interested_plan"),
        landing_audience: audience,
        landing_path: window.location.pathname,
        page: window.location.href,
        referrer: document.referrer || "",
        timestamp: new Date().toISOString()
      }, storedTracking(), extra || {});

      TRACKING_KEYS.forEach((key) => {
        if (!payload[key]) payload[key] = tracking.get(key) || "";
      });

      /* Local visual QA must never add synthetic rows to the live leads sheet. */
      if (IS_LOCAL_PREVIEW) {
        window.console && console.info("GeniusCFO local preview: lead payload suppressed.", payload);
        return;
      }

      if (!LEAD_ENDPOINT) {
        window.console && console.warn(
          "GeniusCFO: LEAD_ENDPOINT is not set in assets/site.js — lead not sent.",
          payload
        );
        return;
      }

      /* The response is opaque, so success cannot be read. The .catch is not
         optional: without it a blocked or offline POST rejects unhandled and
         surfaces as an uncaught "Failed to fetch" page error. */
      try {
        const request = window.fetch(LEAD_ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          body: new URLSearchParams(payload)
        });
        if (request && typeof request.catch === "function") {
          request.catch(() => { /* network refused the beacon — nothing to do */ });
        }
      } catch (error) { /* fetch unavailable — nothing to handle */ }
    };

    const submitStepOne = (event) => {
      event.preventDefault();
      clearErrors();

      let ok = true;
      if (!value("name")) { showError("name", "Please enter your name."); ok = false; }
      if (!value("company")) {
        showError("company", track === "practice" ? "Please enter your firm name." : "Please enter your business name.");
        ok = false;
      }
      const phone = value("phone").replace(/\D/g, "");
      if (!/^[6-9]\d{9}$/.test(phone)) {
        showError("phone", "Enter a valid 10-digit Indian mobile number.");
        ok = false;
      }
      const email = value("email");
      if (!email) {
        showError("email", "Please enter your email address.");
        ok = false;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        showError("email", "That email doesn't look right.");
        ok = false;
      }
      if (!state.role) { showError("role", "Please choose the option that describes you."); ok = false; }
      const consent = field("consent");
      if (consent && !consent.checked) {
        showError("consent", "Please confirm we may contact you about your access request.");
        ok = false;
      }
      if (!ok) {
        /* Move the caret to the first field that needs attention rather than
           only scrolling it into view — keyboard and screen-reader users
           otherwise have to hunt for it. */
        const firstInvalid = root.querySelector('[aria-invalid="true"]');
        const firstError = root.querySelector("[data-lead-error]:not([hidden])");
        const focusTarget = (firstInvalid && firstInvalid.type !== "hidden")
          ? firstInvalid
          : (firstError && firstError.dataset.leadError === "consent" ? field("consent") : null);

        if (focusTarget && typeof focusTarget.focus === "function") {
          focusTarget.focus({ preventScroll: true });
          if (typeof focusTarget.scrollIntoView === "function") {
            focusTarget.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        } else if (firstError && typeof firstError.scrollIntoView === "function") {
          firstError.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        return;
      }

      /* Step 1 is a contact record, not a conversion. */
      pushDataLayer("lead_step1_complete", {
        role: state.role,
        track: track,
        whatsapp_optin: consent && consent.checked ? "yes" : "no"
      });
      send({ step: "1" });
      setStep(2);
    };

    const submitStepTwo = (event) => {
      event.preventDefault();
      /* Step 2 saves the triage answers and opens Cal.com. It is not a booked
         appointment, so no conversion event fires here. */
      const consentField = field("consent");
      const leadParams = {
        role: state.role,
        track: track,
        challenge: state.challenge,
        accounting_tool: state.tool,
        client_accounting_tool: state.clientTool,
        client_count: state.clientCount,
        whatsapp_optin: consentField && consentField.checked ? "yes" : "no"
      };
      pushDataLayer("lead_step2_complete", leadParams);
      send({
        step: "2",
        challenge: state.challenge,
        accounting_tool: state.tool,
        client_accounting_tool: state.clientTool,
        client_count: state.clientCount
      });
      setStep(3);
    };

    const stepOneForm = root.querySelector("[data-lead-submit-step1]");
    if (stepOneForm) stepOneForm.addEventListener("submit", submitStepOne);

    const stepTwoForm = root.querySelector("[data-lead-submit-step2]");
    if (stepTwoForm) stepTwoForm.addEventListener("submit", submitStepTwo);

    root.querySelectorAll("[data-lead-back]").forEach((button) => {
      button.addEventListener("click", () => setStep(1));
    });

    setStep(1);
  });

  /* ====================================================================
     Ask module, lightbox, pricing deep links
     ==================================================================== */

  /* A table wrapper that actually scrolls sideways must be reachable by
     keyboard, and needs a name once it is focusable. Applied only when the
     content overflows, so wrappers that fit stay out of the tab order. */
  const syncScrollableTables = () => {
    document.querySelectorAll(".ruled-table-wrap").forEach((wrap) => {
      const scrolls = wrap.scrollWidth > wrap.clientWidth + 1;
      if (scrolls) {
        wrap.setAttribute("tabindex", "0");
        wrap.setAttribute("role", "region");
        if (!wrap.getAttribute("aria-label")) {
          const caption = wrap.querySelector("caption");
          wrap.setAttribute("aria-label", (caption && caption.textContent.trim()) || "Scrollable table");
        }
      } else {
        wrap.removeAttribute("tabindex");
        wrap.removeAttribute("role");
      }
    });
  };

  syncScrollableTables();
  window.addEventListener("resize", syncScrollableTables);

  document.querySelectorAll("[data-ask-module]").forEach((module) => {
    const choices = Array.from(module.querySelectorAll("[data-ask-choice]"));
    const answers = Array.from(module.querySelectorAll("[data-ask-answer]"));

    const showAnswer = (answerName) => {
      choices.forEach((choice) => {
        choice.setAttribute("aria-pressed", String(choice.dataset.askChoice === answerName));
      });
      answers.forEach((answer) => {
        answer.hidden = answer.dataset.askAnswer !== answerName;
      });
    };

    choices.forEach((choice) => {
      choice.addEventListener("click", () => showAnswer(choice.dataset.askChoice));
    });

    if (choices[0]) showAnswer(choices[0].dataset.askChoice);
  });

  /* ====================================================================
     Animated screens (V5)

     A screen that moves ships as a still poster in the HTML and gains its
     animation only after the page has finished loading visibly and the
     element has scrolled into view. Three reasons, in order:

       1. The brief: "the animation should only start once the page has
          completed loading visibly for the user."
       2. The animation is the heaviest asset on the page. Deferring it
          keeps it out of the critical path entirely — LCP is the poster.
       3. It gives us a frame-zero to return to, so the lightbox can replay
          from the start rather than catching the tail of a loop.

     Two encodings of the same animation ship for every motion screen:

       data-motion-video  H.264 MP4  — ~0.6 MB, and a <video> can be seeked,
                                       so replay is exact and free.
       data-motion-image  animated WebP — ~2.4 MB, the named deliverable and
                                       the fallback where MP4 will not play.
                                       Replayed by minting a fresh object URL
                                       from the already-downloaded blob, which
                                       restarts the decode without a refetch.

     In practice every current browser takes the MP4 path. Neither is loaded
     at all under prefers-reduced-motion or Save-Data — those visitors keep
     the poster, which is a legitimate screenshot of the product.
     ==================================================================== */

  const motionMedia = (() => {
    const reduceMotion = window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const thrifty = (() => {
      const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!c) return false;
      if (c.saveData) return true;
      return /(^|-)(2g|slow-2g)$/.test(String(c.effectiveType || ""));
    })();

    /* Two encodings, because neither one is universal: H.264 is absent from
       Chromium builds without proprietary codecs, and VP9-in-WebM is missing
       from older Safari. Between them the coverage is complete. */
    const VIDEO_TYPES = [
      { attr: "motionVideo", type: 'video/mp4; codecs="avc1.42E01E"', mime: "video/mp4" },
      { attr: "motionVideoWebm", type: 'video/webm; codecs="vp9"', mime: "video/webm" }
    ];

    const playableSources = (trigger) =>
      VIDEO_TYPES.filter((candidate) => {
        if (!trigger.dataset[candidate.attr]) return false;
        try {
          const probe = document.createElement("video");
          return !!probe.canPlayType && probe.canPlayType(candidate.type) !== "";
        } catch (error) { return false; }
      });

    const blobs = new Map();
    const fetchBlob = (url) => {
      if (!blobs.has(url)) {
        blobs.set(url, window.fetch(url).then((response) => {
          if (!response.ok) throw new Error("motion asset " + response.status);
          return response.blob();
        }));
      }
      return blobs.get(url);
    };

    /* A fresh object URL for the same blob is a different resource identity,
       which is what makes the decoder start the animation over. The previous
       one is revoked so the blob is not held twice. */
    const freshObjectUrl = (holder, blob) => {
      if (holder.__motionUrl) URL.revokeObjectURL(holder.__motionUrl);
      holder.__motionUrl = URL.createObjectURL(blob);
      return holder.__motionUrl;
    };

    const enabled = !reduceMotion && !thrifty;

    const buildVideo = (trigger, sources, opts) => {
      const video = document.createElement("video");
      video.className = "screen-motion-video";
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("aria-hidden", "true");
      video.preload = "auto";
      video.loop = !!(opts && opts.loop);
      video.controls = !!(opts && opts.controls);
      video.poster = trigger.dataset.motionPoster || "";
      sources.forEach((candidate) => {
        const source = document.createElement("source");
        source.src = trigger.dataset[candidate.attr];
        source.type = candidate.mime;
        video.appendChild(source);
      });
      return video;
    };

    const play = (video) => {
      try {
        video.currentTime = 0;
        const p = video.play();
        if (p && typeof p.catch === "function") p.catch(() => { /* autoplay refused */ });
      } catch (error) { /* nothing to do */ }
    };

    /* ---- in-page: swap the poster for the animation, once, when seen ---- */
    const activate = (trigger) => {
      if (trigger.dataset.motionState === "on") return;
      trigger.dataset.motionState = "on";

      const slot = trigger.querySelector("[data-motion-slot]") || trigger.querySelector(".screen-window");
      if (!slot) return;

      const sources = playableSources(trigger);
      if (sources.length) {
        const video = buildVideo(trigger, sources);
        video.addEventListener("canplay", () => play(video), { once: true });
        slot.appendChild(video);
        slot.classList.add("has-motion");
        return;
      }

      const still = trigger.querySelector("img");
      const animated = trigger.dataset.motionImage;
      if (!still || !animated) return;
      fetchBlob(animated).then((blob) => {
        const picture = still.closest("picture");
        if (picture) {
          picture.querySelectorAll("source").forEach((source) => source.remove());
        }
        still.src = freshObjectUrl(still, blob);
        slot.classList.add("has-motion");
      }).catch(() => { /* keep the poster */ });
    };

    const observe = () => {
      const triggers = Array.from(document.querySelectorAll("[data-motion-video], [data-motion-video-webm], [data-motion-image]"));
      if (!triggers.length) return;

      if (!enabled) {
        triggers.forEach((trigger) => { trigger.dataset.motionState = "still"; });
        return;
      }

      if (typeof IntersectionObserver !== "function") {
        triggers.forEach(activate);
        return;
      }

      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          activate(entry.target);
        });
      }, { rootMargin: "200px 0px" });

      triggers.forEach((trigger) => io.observe(trigger));
    };

    /* "Loaded visibly" is the load event plus two frames — the point at which
       the browser has painted everything it was already committed to. */
    const whenSettled = (fn) => {
      const go = () => requestAnimationFrame(() => requestAnimationFrame(fn));
      if (document.readyState === "complete") go();
      else window.addEventListener("load", go, { once: true });
    };

    whenSettled(observe);

    /* ---- lightbox: build a node that is guaranteed to start at frame 0 ---- */
    const enlarged = (trigger) => {
      if (!enabled) return null;

      const sources = playableSources(trigger);
      if (sources.length) {
        const video = buildVideo(trigger, sources, { controls: true, loop: false });
        video.className = "screen-motion-video is-enlarged";
        video.removeAttribute("aria-hidden");
        video.addEventListener("loadeddata", () => play(video), { once: true });
        return { node: video, replay: () => play(video) };
      }

      if (trigger.dataset.motionImage) {
        const image = document.createElement("img");
        image.alt = (trigger.querySelector("img") || {}).alt || "";
        const load = () => fetchBlob(trigger.dataset.motionImage)
          .then((blob) => { image.src = freshObjectUrl(image, blob); })
          .catch(() => { image.src = trigger.getAttribute("href"); });
        load();
        return { node: image, replay: load };
      }

      return null;
    };

    return { enlarged: enlarged, enabled: enabled };
  })();

  const imageDialog = document.querySelector("[data-image-dialog]");
  if (imageDialog && typeof imageDialog.showModal === "function") {
    const dialogImage = imageDialog.querySelector("[data-image-dialog-image]");
    const dialogTitle = imageDialog.querySelector("[data-image-dialog-title]");
    const dialogStage = imageDialog.querySelector(".image-dialog-stage");
    const closeButton = imageDialog.querySelector("[data-image-dialog-close]");
    const replayButton = imageDialog.querySelector("[data-image-dialog-replay]");
    let lastImageTrigger = null;
    let motionNode = null;
    let motionReplay = null;

    const clearMotion = () => {
      if (motionNode && motionNode.parentNode) motionNode.parentNode.removeChild(motionNode);
      if (motionNode && motionNode.__motionUrl) URL.revokeObjectURL(motionNode.__motionUrl);
      motionNode = null;
      motionReplay = null;
      if (dialogImage) dialogImage.hidden = false;
      if (replayButton) replayButton.hidden = true;
    };

    document.querySelectorAll("[data-lightbox]").forEach((trigger) => {
      trigger.addEventListener("click", (event) => {
        const sourceImage = trigger.querySelector("img");
        if (!sourceImage || !dialogImage || !dialogTitle) return;

        event.preventDefault();
        clearMotion();
        lastImageTrigger = trigger;
        dialogTitle.textContent = trigger.dataset.imageLabel || sourceImage.alt;

        /* An animated screen opens as the animation, played from the start.
           Everything else opens as the full-size still it links to. */
        const motion = motionMedia.enlarged(trigger);
        if (motion && dialogStage) {
          dialogImage.hidden = true;
          dialogImage.removeAttribute("src");
          motionNode = motion.node;
          motionReplay = motion.replay;
          dialogStage.appendChild(motionNode);
          if (replayButton) replayButton.hidden = false;
        } else {
          dialogImage.src = trigger.href;
          dialogImage.alt = sourceImage.alt;
        }

        imageDialog.showModal();
        document.body.classList.add("image-dialog-open");
        if (closeButton) closeButton.focus();
      });
    });

    if (replayButton) {
      replayButton.addEventListener("click", () => {
        if (motionReplay) motionReplay();
      });
    }

    if (closeButton) {
      closeButton.addEventListener("click", () => imageDialog.close());
    }

    imageDialog.addEventListener("click", (event) => {
      if (event.target === imageDialog) imageDialog.close();
    });

    imageDialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && imageDialog.open) {
        event.preventDefault();
        imageDialog.close();
      }
    });

    imageDialog.addEventListener("close", () => {
      document.body.classList.remove("image-dialog-open");
      clearMotion();
      dialogImage.removeAttribute("src");
      if (lastImageTrigger) lastImageTrigger.focus();
    });
  }

  if (window.location.pathname.toLowerCase().includes("pricing")) {
    document.documentElement.dataset.pricingAudience = audience;
    const selected = document.querySelector(`[data-pricing-choice="${audience}"]`);
    if (selected) selected.setAttribute("aria-current", "true");
  }
})();
