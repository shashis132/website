#!/usr/bin/env node
/**
 * check-routing.js — a new page is wired up everywhere, or it 404s in production.
 *
 *   node .claude/skills/building-landing-pages/scripts/check-routing.js
 *
 * Vercel serves this repository's root as static files, and every clean URL is
 * a rewrite in vercel.json. A page that works perfectly on `python3 -m
 * http.server` still 404s live when its rewrite is missing, which is the whole
 * reason this check exists. For each page it verifies:
 *
 *   - the canonical tag matches the URL the file's path implies
 *   - vercel.json rewrites that URL to the file
 *   - vercel.json redirects the trailing-slash and /index.html forms to it
 *   - sitemap.xml lists the canonical
 *   - og:url equals the canonical
 *
 * and across the whole repository, that no file mentions the www host: the
 * canonical host is the bare apex, and a www URL is a canonical pointing at a
 * redirect.
 *
 * Exits 1 on any failure.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(process.argv[2] || process.cwd());
const APEX = "https://geniuscfo.ai";

/* These three shipped before the trailing-slash rule was learned and work in
   production without those redirects, so they are not failures. Adding the
   redirects would make them consistent; until then they stay listed here so
   the check is useful for everything else. */
const LEGACY_WITHOUT_SLASH_REDIRECTS = new Set(["/business", "/ca-firms", "/pricing"]);

/* The root index.html is a redirect stub to /business, not a page. */
const NOT_A_PAGE = new Set(["index.html"]);

/* Directories with no pages in them. assets/ is listed so the page walk skips
   it, but the www scan below deliberately re-enters it: a www URL in a
   stylesheet or a JSON file counts just as much as one in a canonical tag. */
const SKIP_DIRS = new Set([".git", ".claude", "node_modules", "qa", "apps-script", "tools", "assets"]);

const fail = [];
const warn = [];
const ok = (m) => console.log(`  ok  ${m}`);
const bad = (m) => { fail.push(m); console.error(`FAIL  ${m}`); };

function read(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    console.error(`Missing ${rel} — run this from the repository root.`);
    process.exit(1);
  }
  return fs.readFileSync(full, "utf8");
}

function pages(dir = ROOT, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) pages(full, found);
    else if (entry.name === "index.html" && !NOT_A_PAGE.has(path.relative(ROOT, full))) found.push(full);
  }
  return found;
}

let config;
try {
  config = JSON.parse(read("vercel.json"));
} catch (err) {
  console.error(`vercel.json does not parse: ${err.message}`);
  process.exit(1);
}
const rewrites = new Map((config.rewrites || []).map((r) => [r.source, r.destination]));
const redirects = new Map((config.redirects || []).map((r) => [r.source, r.destination]));
const sitemap = read("sitemap.xml");
const llms = read("llms.txt");

const found = pages().sort();
console.log(`${found.length} pages\n`);

for (const file of found) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const url = "/" + rel.replace(/\/index\.html$/, "");
  const canonicalWanted = APEX + url;
  const src = fs.readFileSync(file, "utf8");

  const canonical = (src.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  const ogUrl = (src.match(/<meta property="og:url" content="([^"]+)"/) || [])[1];

  console.log(url);
  if (canonical !== canonicalWanted) bad(`${url}: canonical is ${canonical || "(missing)"}, expected ${canonicalWanted}`);
  else ok("canonical matches the path");

  if (ogUrl !== canonical) bad(`${url}: og:url (${ogUrl || "missing"}) does not equal the canonical`);
  else ok("og:url equals canonical");

  if (rewrites.get(url) !== `/${rel}`) {
    bad(`${url}: vercel.json has no rewrite to /${rel} — this 404s in production while working locally`);
  } else ok("vercel.json rewrite present");

  for (const variant of [`${url}/`, `${url}/index.html`]) {
    if (redirects.get(variant) === url) { ok(`redirect ${variant}`); continue; }
    if (LEGACY_WITHOUT_SLASH_REDIRECTS.has(url)) {
      warn.push(`${url}: no redirect for ${variant} (shipped before the rule; works in production)`);
      console.log(`  --  redirect ${variant} absent (known, pre-dates the rule)`);
    } else {
      bad(`${url}: vercel.json has no redirect from ${variant}`);
    }
  }

  if (!sitemap.includes(`<loc>${canonicalWanted}</loc>`)) bad(`${url}: not in sitemap.xml`);
  else ok("listed in sitemap.xml");

  /* Pieces inside /stories and /blog are reached through their index, which is
     what llms.txt lists; every other page is named directly. */
  const indexed = /^\/(stories|blog)\//.test(url);
  if (!indexed && !llms.includes(canonicalWanted)) bad(`${url}: not mentioned in llms.txt`);
  else ok(indexed ? "covered by its section index in llms.txt" : "mentioned in llms.txt");

  console.log("");
}

/* The canonical host is the bare apex everywhere: canonical tags, og:url,
   sitemap, llms files and every @id, url and item in the JSON-LD. */
const wwwHits = [];
(function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name) && entry.name !== "assets") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { scan(full); continue; }
    if (!/\.(html|txt|xml|json)$/.test(entry.name)) continue;
    const body = fs.readFileSync(full, "utf8");
    body.split("\n").forEach((line, i) => {
      if (line.includes("www.geniuscfo.ai")) {
        wwwHits.push(`${path.relative(ROOT, full)}:${i + 1}`);
      }
    });
  }
})(ROOT);

if (wwwHits.length) bad(`www.geniuscfo.ai appears in: ${wwwHits.join(", ")} — the canonical host is the bare apex`);
else ok("no www.geniuscfo.ai anywhere");

console.log(`\n${fail.length ? `${fail.length} FAILURE(S)` : "routing complete"}${warn.length ? ` · ${warn.length} known gap(s)` : ""}`);
for (const w of warn) console.log(`  --  ${w}`);
process.exit(fail.length ? 1 : 0);
