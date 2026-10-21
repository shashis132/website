#!/usr/bin/env node
/**
 * check-shared-schema.js — the JSON-LD @id drift check.
 *
 *   node .claude/skills/building-landing-pages/scripts/check-shared-schema.js
 *   node .claude/skills/building-landing-pages/scripts/check-shared-schema.js --update-baseline
 *
 * Several JSON-LD nodes are repeated on every page and share one @id: the
 * Organization, the WebSite, the SoftwareApplication. One @id must have one
 * definition. Two pages describing the same @id differently is what broke the
 * site's schema on 11 September 2026, when #organization carried the apex URL
 * on the product pages and www on the stories.
 *
 * Every @id that appears on more than one page must be identical on all of
 * them. The rule is generic rather than a list of three ids, so a shared node
 * added later is covered without editing this script.
 *
 * The repository already carries drift that predates this check (see
 * known-drift.json, written beside this script). That file is the baseline:
 * the check fails on drift that is NOT in it, so a new page cannot introduce
 * more, while the existing items stay listed as outstanding work rather than
 * being silently blessed. After deliberately fixing or changing a shared node,
 * re-run with --update-baseline and commit the result.
 *
 * Exit 0 when the only drift is baselined, 1 otherwise.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SKILL_DIR = path.resolve(__dirname, "..");
const BASELINE = path.join(SKILL_DIR, "scripts", "known-drift.json");
const update = process.argv.includes("--update-baseline");
const rootArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
const ROOT = path.resolve(rootArg || process.cwd());

/* Directories that hold no deployed pages. */
const SKIP = new Set([".git", ".claude", "node_modules", "qa", "apps-script", "tools"]);

function htmlFiles(dir, found = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    console.error(`Cannot read ${dir}: ${err.message}`);
    process.exit(1);
  }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(full, found);
    else if (entry.name.endsWith(".html")) found.push(full);
  }
  return found;
}

/* Key order is not drift; values are. */
const stable = (obj) =>
  JSON.stringify(obj, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v);

const fingerprint = (node) => crypto.createHash("sha1").update(stable(node)).digest("hex").slice(0, 12);

function nodesOf(file) {
  const src = fs.readFileSync(file, "utf8");
  const out = [];
  for (const [, body] of src.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (err) {
      console.error(`FAIL  ${path.relative(ROOT, file)}: JSON-LD does not parse — ${err.message}`);
      process.exitCode = 1;
      continue;
    }
    for (const node of parsed["@graph"] || [parsed]) {
      if (node && node["@id"]) out.push(node);
    }
  }
  return out;
}

const files = htmlFiles(ROOT).sort();
if (files.length === 0) {
  console.error(`No .html files under ${ROOT}. Run this from the repository root, or pass the root as an argument.`);
  process.exit(1);
}

const byId = new Map();
for (const file of files) {
  for (const node of nodesOf(file)) {
    const rel = path.relative(ROOT, file);
    if (!byId.has(node["@id"])) byId.set(node["@id"], []);
    byId.get(node["@id"]).push({ rel, node });
  }
}

let baseline = {};
if (!update && fs.existsSync(BASELINE)) {
  try {
    baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8")).drift || {};
  } catch (err) {
    console.error(`Baseline ${BASELINE} is unreadable (${err.message}). Delete it and re-run with --update-baseline.`);
    process.exit(1);
  }
}

const found = {};
let newDrift = 0;
let baselined = 0;
let clean = 0;

for (const [id, copies] of [...byId].sort()) {
  if (new Set(copies.map((c) => c.rel)).size < 2) continue; // page-specific id

  const first = copies[0];
  const odd = copies.filter((c) => stable(c.node) !== stable(first.node));
  if (odd.length === 0) {
    clean += 1;
    console.log(`  ok  ${id} — identical across ${copies.length} pages`);
    continue;
  }

  const keys = [...new Set(odd.flatMap((c) => differingKeys(first.node, c.node)))].sort();
  /* Fingerprint every page's copy. Recording only which pages and keys differ
     is not enough: a second edit to an already-drifted key on an already-
     drifted page would match the record and pass. */
  const variants = {};
  for (const c of copies) variants[c.rel] = fingerprint(c.node);
  found[id] = { keys, variants };

  const known = baseline[id];
  const same = known && JSON.stringify(known.variants) === JSON.stringify(variants);

  if (same) {
    baselined += 1;
    console.log(`WARN  ${id} — known drift, unchanged (${keys.join(", ")})`);
    continue;
  }

  newDrift += 1;
  process.exitCode = 1;
  const changed = known
    ? Object.keys(variants).filter((f) => known.variants[f] !== variants[f])
    : [];
  console.error(`FAIL  ${id} — ${known ? "a page's copy CHANGED since the baseline" : "NEW drift"}`);
  if (changed.length) console.error(`      changed on:    ${changed.join(", ")}`);
  console.error(`      baseline page: ${first.rel}`);
  for (const c of odd) {
    console.error(`      differs on:    ${c.rel}`);
  }
  for (const k of keys.slice(0, 4)) {
    console.error(`        ${k}:`);
    console.error(`          ${first.rel}  ${short(first.node[k])}`);
    console.error(`          ${odd[0].rel}  ${short(odd[0].node[k])}`);
  }
}

function differingKeys(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => stable(a[k] ?? null) !== stable(b[k] ?? null));
}

function short(v) {
  if (v === undefined) return "(absent)";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 80 ? s.slice(0, 80) + "…" : s;
}

if (update) {
  fs.writeFileSync(BASELINE, JSON.stringify({
    note: "Shared @id nodes that already differ between pages. Each one is a " +
          "bug to fix, not an approved pattern: one @id must have one definition. " +
          "The check fails on drift that is not listed here, so a new page cannot " +
          "add more. Re-record with --update-baseline after fixing one.",
    recorded: new Date().toISOString().slice(0, 10),
    drift: found,
  }, null, 2) + "\n");
  console.log(`\nBaseline written to ${path.relative(ROOT, BASELINE)} — ${Object.keys(found).length} drifted @id(s) recorded.`);
  process.exitCode = 0;
} else {
  console.log(`\n${files.length} pages · ${clean} shared @id clean · ${baselined} known drift · ${newDrift} new`);
  if (newDrift) {
    console.error(
      "\nA shared @id must have exactly one definition. Copy the baseline page's\n" +
      "node verbatim into the page that differs — do not reword it to suit that\n" +
      "page. If the change was deliberate, apply it to every page that carries\n" +
      "the node, then re-run with --update-baseline."
    );
  }
}
