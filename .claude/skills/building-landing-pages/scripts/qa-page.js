#!/usr/bin/env node
/**
 * qa-page.js — the browser pass for one page.
 *
 *   node .claude/skills/building-landing-pages/scripts/qa-page.js <url> [--hooks <file>] [--shots <dir>]
 *
 * Example:
 *   python3 -m http.server 8099 &
 *   node .../qa-page.js http://127.0.0.1:8099/business/sellers/ --hooks assets/hooks.json
 *
 * There is no test suite in this repository, so this is the gate. It checks
 * what markup review cannot: that the page renders, that nothing overflows a
 * phone, that the primary call to action is reachable without scrolling, that
 * the FAQ schema still matches the words on screen, and that the ad hook swap
 * puts the right headline up for every route without shifting the layout.
 *
 * Needs Playwright and Chromium. In this sandbox:
 *   NODE_PATH=/opt/node22/lib/node_modules node .../qa-page.js <url>
 * Chromium lives at /opt/pw-browsers/chromium.
 *
 * Exits 1 on any failure.
 */
const fs = require("fs");
const path = require("path");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (err) {
  console.error(
    "Playwright is not on the module path.\n" +
    "In this sandbox, run it as:\n" +
    "  NODE_PATH=/opt/node22/lib/node_modules node " + path.relative(process.cwd(), __filename) + " <url>\n" +
    "Elsewhere: npm install playwright"
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const url = args.find((a) => /^https?:\/\//.test(a));
if (!url) {
  console.error("Usage: qa-page.js <url> [--hooks <hooks.json>] [--shots <dir>]\nThe URL must be absolute, e.g. http://127.0.0.1:8099/business/sellers/");
  process.exit(1);
}
const hooksArg = args[args.indexOf("--hooks") + 1];
const hooksFile = args.includes("--hooks") ? hooksArg : null;

/* --shots <dir> saves one screenshot per hook route. The browser is already on
   every route, so this makes the "look at it" step of the workflow cheap. */
const shotDir = args.includes("--shots") ? args[args.indexOf("--shots") + 1] : null;
if (shotDir) {
  try {
    fs.mkdirSync(shotDir, { recursive: true });
  } catch (err) {
    console.error(`Cannot create --shots directory ${shotDir}: ${err.message}`);
    process.exit(1);
  }
}

/* Hosts this sandbox cannot reach by policy. Their failures are expected and
   are verified live instead, so they must not mask a real console error. */
const UNREACHABLE = /recaptcha|google\.com|googletagmanager|rzp\.io|cal\.com|ERR_TUNNEL|ERR_NAME|ERR_BLOCKED/i;

/* A visitor who has to scroll to find the button is a visitor the ad paid for
   and lost, so the hero CTA is checked against a laptop fold. */
const FOLD = 900;

const fails = [];
const note = (ok, label) => { if (!ok) fails.push(label); console.log(`${ok ? "  ok " : "FAIL "} ${label}`); };

const browserOpts = fs.existsSync("/opt/pw-browsers/chromium")
  ? { executablePath: "/opt/pw-browsers/chromium" }
  : {};

(async () => {
  const browser = await chromium.launch(browserOpts);

  // ---- structure, schema, language -------------------------------------
  const page = await browser.newPage({ viewport: { width: 1440, height: FOLD } });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

  const response = await page.goto(url, { waitUntil: "networkidle" });
  if (!response || !response.ok()) {
    console.error(`FAIL  ${url} returned ${response ? response.status() : "no response"}`);
    await browser.close();
    process.exit(1);
  }

  console.log(`\n--- ${url} ---`);
  const real = errors.filter((e) => !UNREACHABLE.test(e));
  note(real.length === 0, `console clean (${real.join(" | ") || "nothing beyond the hosts this sandbox cannot reach"})`);
  note((await page.locator("h1").count()) === 1, "exactly one h1");

  const ld = await page.$$eval('script[type="application/ld+json"]', (nodes) =>
    nodes.map((n) => { try { JSON.parse(n.textContent); return null; } catch (e) { return e.message; } }).filter(Boolean));
  note(ld.length === 0, `JSON-LD parses (${ld.join("; ") || "all blocks"})`);

  const canonical = await page.getAttribute('link[rel="canonical"]', "href");
  const ogUrl = await page.getAttribute('meta[property="og:url"]', "content");
  note(canonical === ogUrl, `canonical equals og:url (${canonical})`);

  /* Answer engines lift the FAQ answer from the schema and show it beside the
     page. If the two drift, the quote is wrong. */
  const faqCount = await page.locator(".faq-list details").count();
  if (faqCount) {
    const schema = await page.$$eval('script[type="application/ld+json"]', (nodes) => {
      for (const n of nodes) {
        const graph = JSON.parse(n.textContent)["@graph"] || [JSON.parse(n.textContent)];
        const faq = graph.find((x) => x["@type"] === "FAQPage");
        if (faq) return faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]);
      }
      return null;
    });
    const visible = await page.$$eval(".faq-list details", (ds) =>
      ds.map((d) => [d.querySelector("summary").textContent.trim(), d.querySelector(".faq-answer").textContent.trim()]));
    note(schema && JSON.stringify(schema) === JSON.stringify(visible),
         `FAQ schema matches the visible answers word for word (${faqCount} questions)`);
  }

  /* Brand copy rules. Pages that shipped before these were enforced do carry
     em dashes; that is a real finding on those pages rather than a false
     positive, but fixing them is the page author's call. A new page comes
     back clean. */
  console.log("\n--- brand copy rules ---");
  const body = await page.evaluate(() => document.body.innerText);
  note(!body.includes("—"), "no em dashes");
  note(!body.includes("!"), "no exclamation marks");
  note(!/\bRs\.?\b/.test(body), "no 'Rs' (the rupee sign is used)");
  note(!/aggregateRating/i.test(await page.content()), "no aggregateRating, reviews or counts");

  /* The hero CTA must be reachable without scrolling on a laptop. */
  const cta = page.locator(".hero-actions .btn, .hero .btn-primary").first();
  if (await cta.count()) {
    const top = await cta.evaluate((el) => Math.round(el.getBoundingClientRect().top));
    note(top > 0 && top < FOLD, `hero CTA sits at y=${top}, above the ${FOLD}px fold (default hook; every route is measured in the hook-swap pass)`);
  }
  await page.close();

  // ---- phone widths -----------------------------------------------------
  console.log("\n--- phone widths ---");
  for (const width of [360, 390]) {
    const p = await browser.newPage({ viewport: { width, height: 844 } });
    await p.goto(url, { waitUntil: "networkidle" });
    const over = await p.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth,
      culprits: Array.from(document.querySelectorAll("body *"))
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 4)
        .map((el) => el.tagName.toLowerCase() + "." + String(el.className || "").split(" ")[0]),
    }));
    note(over.doc <= over.win,
         `no sideways scroll at ${width}px${over.doc > over.win ? ` — ${over.culprits.join(", ")}` : ""}`);
    await p.close();
  }

  // ---- the ad hook swap --------------------------------------------------
  if (hooksFile) {
    const full = path.resolve(hooksFile);
    if (!fs.existsSync(full)) {
      console.error(`\nFAIL  hooks file not found: ${full}`);
      fails.push("hooks file missing");
    } else {
      const { routes, default: fallbackKey } = JSON.parse(fs.readFileSync(full, "utf8"));
      const base = url.split("?")[0];
      const fallback = routes[fallbackKey];
      console.log(`\n--- hook swap (${Object.keys(routes).length} routes) ---`);

      for (const [key, lines] of Object.entries(routes)) {
        /* Laptop viewport and a settled layout, because this loop also measures
           where each hook leaves the CTA. A long hook is exactly what pushes it
           below the fold, so measuring only the default misses the ones that
           matter. */
        const p = await browser.newPage({ viewport: { width: 1440, height: FOLD } });
        await p.goto(`${base}?r=${encodeURIComponent(key)}`, { waitUntil: "networkidle" });
        const got1 = await p.textContent("#hook-l1");
        const two = p.locator("#hook-l2");
        const got2 = (await two.evaluate((n) => n.hidden)) ? null : await two.textContent();
        const route = await p.getAttribute("main", "data-route");
        const dl = await p.evaluate(() => (window.dataLayer || []).find((e) => e.event === "p1_hook_view"));

        const ctaTop = await p.evaluate(() => {
          const el = document.querySelector(".hero-actions .btn, .hero .btn-primary");
          return el ? Math.round(el.getBoundingClientRect().top) : null;
        });
        const textOk = got1 === lines.l1 && got2 === lines.l2 && route === key && dl && dl.route_id === key;
        const ctaOk = ctaTop === null || (ctaTop > 0 && ctaTop < FOLD);
        note(textOk && ctaOk,
             `${key} -> "${got1}"${got2 ? ` / "${got2}"` : " (one line)"}` +
             (ctaTop === null ? "" : ` · CTA y=${ctaTop}${ctaOk ? "" : ` BELOW THE ${FOLD}px FOLD`}`));

        if (shotDir) await p.screenshot({ path: path.join(shotDir, `hook-${key}.png`) });
        await p.close();
      }

      /* The fallback that carries real traffic. Ad platforms strip parameters
         they do not recognise, so utm_content is often the only id that
         arrives; r must still win when both are present. */
      console.log("\n--- utm_content fallback ---");
      const [firstKey, firstLines] = Object.entries(routes)[0];
      const [otherKey, otherLines] = Object.entries(routes)[1] || [firstKey, firstLines];
      for (const [query, expect, why] of [
        [`?utm_content=${encodeURIComponent(firstKey)}`, firstLines, "utm_content alone is honoured"],
        [`?r=${encodeURIComponent(otherKey)}&utm_content=${encodeURIComponent(firstKey)}`, otherLines, "r wins when both are present"],
      ]) {
        const p = await browser.newPage();
        await p.goto(base + query, { waitUntil: "domcontentloaded" });
        const got = await p.textContent("#hook-l1");
        note(got === expect.l1, `${why} -> "${got}"`);
        await p.close();
      }

      /* A junk, hostile or absent parameter must leave the default standing
         and must never print anything from the URL. */
      console.log("\n--- hook swap, bad input ---");
      for (const q of ["?r=nonsense", "?r=constructor", "?r=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E", ""]) {
        const p = await browser.newPage();
        const errs = [];
        p.on("pageerror", (e) => errs.push(e.message));
        await p.goto(base + q, { waitUntil: "domcontentloaded" });
        const got = await p.textContent("#hook-l1");
        const route = await p.getAttribute("main", "data-route");
        const leaked = await p.evaluate(() =>
          document.body.innerText.includes("onerror") ||
          Array.from(document.querySelectorAll("*")).some((el) => el.getAttribute("onerror")) ||
          Array.from(document.querySelectorAll("a[href]")).some((a) => /^javascript:/i.test(a.getAttribute("href"))));
        note(got === fallback.l1 && route === "default" && !leaked && errs.length === 0,
             `"${q || "(no parameter)"}" falls back to the default hook, nothing from the URL rendered`);
        await p.close();
      }

      /* The swap runs before first paint, so a shorter hook must not move the
         page. Measured on the shortest and longest routes. */
      console.log("\n--- layout shift ---");
      const byLength = Object.entries(routes)
        .sort((a, b) => (a[1].l1 + (a[1].l2 || "")).length - (b[1].l1 + (b[1].l2 || "")).length);
      for (const [key] of [byLength[0], byLength[byLength.length - 1]]) {
        const p = await browser.newPage({ viewport: { width: 1440, height: FOLD } });
        await p.addInitScript(() => {
          window.__cls = 0;
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
          }).observe({ type: "layout-shift", buffered: true });
        });
        await p.goto(`${base}?r=${encodeURIComponent(key)}`, { waitUntil: "networkidle" });
        await p.waitForTimeout(600);
        const cls = await p.evaluate(() => window.__cls);
        note(cls < 0.1, `CLS on ${key} = ${cls.toFixed(4)}`);
        await p.close();
      }
    }
  }

  await browser.close();
  console.log(`\n${fails.length === 0 ? "PASSED" : `${fails.length} FAILURE(S):\n- ` + fails.join("\n- ")}`);
  process.exit(fails.length ? 1 : 0);
})().catch((err) => {
  console.error("qa-page.js crashed:", err.message);
  process.exit(1);
});
