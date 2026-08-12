(() => {
  "use strict";

  document.documentElement.classList.add("js");

  /* --------------------------------------------------------------------
     Lead capture endpoint.

     PASTE THE GOOGLE APPS SCRIPT WEB APP URL HERE. It is the only place the
     leads sheet is configured. The URL looks like:

       https://script.google.com/macros/s/AKfycb…/exec

     Deploy the script as a web app with "Execute as: Me" and "Who has
     access: Anyone", then copy the /exec URL. Redeploying the script mints
     a new id, so this constant has to be updated with it.

     Two POSTs per lead: step 1 on contact submit, step 2 on triage submit,
     both carrying the same phone and email so the sheet can merge them.
     Sent with mode:"no-cors" — the opaque response is expected and ignored,
     so a failed write is silent. Test with a real submission after wiring.

     While this is empty, nothing is posted and the form still advances; a
     warning is logged to the console on each submit.
     -------------------------------------------------------------------- */
  const LEAD_ENDPOINT = "";

  const TRACKING_KEYS = [
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    "gclid", "fbclid", "msclkid"
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
     Step 3 — confirmation.  Each of steps 1 and 2 POSTs to the sheet.
     ==================================================================== */

  const FIRM_ROLES = ["ca_firm", "cfo_firm"];

  document.querySelectorAll("[data-lead-form]").forEach((root) => {
    const track = root.dataset.leadTrack === "practice" ? "practice" : "business";
    const steps = {
      1: root.querySelector('[data-lead-step="1"]'),
      2: root.querySelector('[data-lead-step="2"]'),
      3: root.querySelector('[data-lead-step="3"]')
    };
    const progress = Array.from(root.querySelectorAll("[data-lead-progress] span"));
    const turnoverField = root.querySelector("[data-turnover-field]");
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
      clientCount: ""
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

    const setStep = (next) => {
      state.step = next;
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
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        showError("email", "That email doesn't look right.");
        ok = false;
      }
      if (!state.role) { showError("role", "Please choose the option that describes you."); ok = false; }
      const consent = field("consent");
      if (consent && !consent.checked) {
        showError("consent", "Please confirm we may contact you about your demo.");
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

      pushDataLayer("generate_lead", {
        role: state.role,
        track: track,
        whatsapp_optin: consent && consent.checked ? "yes" : "no"
      });
      send({ step: "1" });
      setStep(2);
    };

    const submitStepTwo = (event) => {
      event.preventDefault();
      pushDataLayer("lead_step2_complete", {
        role: state.role,
        track: track,
        challenge: state.challenge,
        accounting_tool: state.tool,
        client_accounting_tool: state.clientTool,
        client_count: state.clientCount
      });
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

  const imageDialog = document.querySelector("[data-image-dialog]");
  if (imageDialog && typeof imageDialog.showModal === "function") {
    const dialogImage = imageDialog.querySelector("[data-image-dialog-image]");
    const dialogTitle = imageDialog.querySelector("[data-image-dialog-title]");
    const closeButton = imageDialog.querySelector("[data-image-dialog-close]");
    let lastImageTrigger = null;

    document.querySelectorAll("[data-lightbox]").forEach((trigger) => {
      trigger.addEventListener("click", (event) => {
        const sourceImage = trigger.querySelector("img");
        if (!sourceImage || !dialogImage || !dialogTitle) return;

        event.preventDefault();
        lastImageTrigger = trigger;
        dialogImage.src = trigger.href;
        dialogImage.alt = sourceImage.alt;
        dialogTitle.textContent = trigger.dataset.imageLabel || sourceImage.alt;
        imageDialog.showModal();
        document.body.classList.add("image-dialog-open");
        if (closeButton) closeButton.focus();
      });
    });

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
