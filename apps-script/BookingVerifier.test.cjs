/**
 * Unit tests for apps-script/BookingVerifier.gs.
 *
 * Run with:  node apps-script/BookingVerifier.test.cjs
 *
 * The point of these tests is the behaviour the previous version got wrong:
 * a booking must never be left unclaimed because correlation was ambiguous,
 * and a conversion must be delivered exactly once — by the browser or by the
 * server, never both and never neither.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const values = new Map();
const properties = {
  getProperty: (key) => values.has(key) ? values.get(key) : null,
  setProperty(key, value) { values.set(key, value); return this; },
  deleteProperty(key) { values.delete(key); return this; },
  getProperties: () => Object.fromEntries(values)
};

const events = [];
const calendar = {
  getId: () => 'marketing@geniuscfo.ai',
  getEvents: () => events
};

const fetches = [];
/* Lets a single destination be failed while the other succeeds, which is the
   case that would double-count if delivery were tracked as one flag. */
let failWhen = () => false;

const context = {
  console: { log() {}, error() {} },
  Date,
  JSON,
  Math,
  Object,
  RegExp,
  String,
  parseInt,
  isNaN,
  encodeURIComponent,
  PropertiesService: { getScriptProperties: () => properties },
  CalendarApp: {
    getDefaultCalendar: () => calendar,
    getCalendarById: () => calendar
  },
  LockService: {
    getScriptLock: () => ({ waitLock() {}, releaseLock() {} })
  },
  ScriptApp: {
    getProjectTriggers: () => [],
    newTrigger: () => ({
      timeBased() { return this; },
      everyMinutes() { return this; },
      create() { return this; }
    })
  },
  UrlFetchApp: {
    fetch(url, options) {
      fetches.push({ url, options });
      return { getResponseCode: () => failWhen(url) ? 500 : 200 };
    }
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest: (_algorithm, value) => Array.from(crypto.createHash('sha256').update(value).digest()),
    base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString('base64url')
  },
  ContentService: {
    MimeType: { JSON: 'JSON', JAVASCRIPT: 'JAVASCRIPT' },
    createTextOutput(text) {
      return { text, mimeType: '', setMimeType(value) { this.mimeType = value; return this; } };
    }
  }
};

vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'BookingVerifier.gs'), 'utf8'), context);

const minute = 60 * 1000;
const post = (parameter) => JSON.parse(context.doPost({ parameter }).text);
const recordFor = (leadId) => JSON.parse(values.get(`lead:${leadId}`));

const reset = () => {
  values.clear();
  events.length = 0;
  fetches.length = 0;
  failWhen = () => false;
};

/** Registers a lead and backdates it, so windows can be exercised precisely. */
const register = (leadId, { minutesAgo = 5, ...extra } = {}) => {
  const response = post(Object.assign({ lead_id: leadId, track: 'business' }, extra));
  assert.equal(response.status, 'pending');
  const record = recordFor(leadId);
  record.requested_at = new Date(Date.now() - minutesAgo * minute).toISOString();
  values.set(`lead:${leadId}`, JSON.stringify(record));
  return record;
};

const makeEvent = ({ id, title = 'GeniusCFO Demo Call (Someone Else)', createdAt }) => ({
  getId: () => id,
  getTitle: () => title,
  getDateCreated: () => createdAt,
  getStartTime: () => new Date(createdAt.getTime() + 24 * 60 * minute),
  getEndTime: () => new Date(createdAt.getTime() + 24 * 60 * minute + 30 * minute)
});

/* Ages a confirmed record past the browser's grace period. */
const ageConfirmation = (leadId, minutesAgo = 5) => {
  const record = recordFor(leadId);
  record.booking_confirmed_at = new Date(Date.now() - minutesAgo * minute).toISOString();
  values.set(`lead:${leadId}`, JSON.stringify(record));
};

const ids = {
  a: 'lead-aaaaaaaaaaaaaaaaaaaa',
  b: 'lead-bbbbbbbbbbbbbbbbbbbb',
  c: 'lead-cccccccccccccccccccc'
};

/* ---------------------------------------------------------------------------
   1. A booking confirms the pending lead regardless of who booked it.
   The title carries an unrelated name and no email is stored at all.
   --------------------------------------------------------------------------- */
reset();
register(ids.a, { minutesAgo: 4, client_id: '783033440.1776748220', fbp: 'fb.1.123.456' });
events.push(makeEvent({
  id: 'evt-different-account',
  title: 'GeniusCFO Demo Call (Totally Different Person)',
  createdAt: new Date(Date.now() - 3 * minute)
}));
assert.equal(context.claimNewBookings_(), 1, 'a booking from another Google account still confirms');
assert.equal(recordFor(ids.a).status, 'confirmed');
assert.equal(recordFor(ids.a).matched_by, 'time_window');

/* ---------------------------------------------------------------------------
   2. Two leads in the same window is the case the old version abstained on.
   Both bookings must land, each on the nearer lead.
   --------------------------------------------------------------------------- */
reset();
register(ids.a, { minutesAgo: 20 });
register(ids.b, { minutesAgo: 3 });
events.push(makeEvent({ id: 'evt-recent', createdAt: new Date(Date.now() - 2 * minute) }));
assert.equal(context.claimNewBookings_(), 1);
assert.equal(recordFor(ids.b).status, 'confirmed', 'the nearer lead in time wins');
assert.equal(recordFor(ids.a).status, 'pending');

events.push(makeEvent({ id: 'evt-older', createdAt: new Date(Date.now() - 18 * minute) }));
assert.equal(context.claimNewBookings_(), 1);
assert.equal(recordFor(ids.a).status, 'confirmed', 'the second booking claims the remaining lead');

/* ---------------------------------------------------------------------------
   3. Re-scanning the same Calendar event never mints a second conversion.
   --------------------------------------------------------------------------- */
reset();
register(ids.a, { minutesAgo: 2 });
events.push(makeEvent({ id: 'evt-idempotent', createdAt: new Date(Date.now() - 1 * minute) }));
assert.equal(context.claimNewBookings_(), 1);
const firstConversionId = recordFor(ids.a).conversion_event_id;
assert.equal(context.claimNewBookings_(), 0, 'a known event is skipped on the next run');
assert.equal(recordFor(ids.a).conversion_event_id, firstConversionId);

/* ---------------------------------------------------------------------------
   4. A booking with no pending lead in the window still counts.
   --------------------------------------------------------------------------- */
reset();
events.push(makeEvent({ id: 'evt-direct-link', createdAt: new Date(Date.now() - 1 * minute) }));
assert.equal(context.claimNewBookings_(), 1, 'a direct-link booking is not discarded');
const orphanKey = Object.keys(Object.fromEntries(values))[0];
const orphan = JSON.parse(values.get(orphanKey));
assert.equal(orphan.status, 'confirmed');
assert.equal(orphan.attribution, 'unmatched');
assert.match(orphan.lead_id, /^orphan_/);

/* ---------------------------------------------------------------------------
   5. Non-booking Calendar events are ignored.
   --------------------------------------------------------------------------- */
reset();
register(ids.a, { minutesAgo: 2 });
events.push(makeEvent({
  id: 'evt-unrelated',
  title: 'Team standup',
  createdAt: new Date(Date.now() - 1 * minute)
}));
assert.equal(context.claimNewBookings_(), 0, 'only appointment-schedule events count');
assert.equal(recordFor(ids.a).status, 'pending');

/* ---------------------------------------------------------------------------
   6. The server delivers when the browser stays silent — exactly once.
   --------------------------------------------------------------------------- */
reset();
register(ids.a, {
  minutesAgo: 4,
  client_id: '783033440.1776748220',
  session_id: '1787769945',
  fbp: 'fb.1.a',
  fbc: 'fb.1.b',
  user_agent: 'Mozilla/5.0 (Windows NT 10.0) TestBrowser/1.0'
});
events.push(makeEvent({ id: 'evt-backfill', createdAt: new Date(Date.now() - 3 * minute) }));
context.claimNewBookings_();
assert.equal(context.deliverPendingConversions(), 0, 'the browser is given its grace period first');
ageConfirmation(ids.a, 5);
assert.equal(context.deliverPendingConversions(), 1, 'the server sends once the grace period lapses');

assert.equal(fetches.length, 2, 'one hit per destination');
const ga4Hit = fetches.map((f) => f.url).find((url) => /ep\.gcfo_delivery=server_ga4/.test(url));
const metaHit = fetches.map((f) => f.url).find((url) => /ep\.gcfo_delivery=server_meta/.test(url));
assert.ok(ga4Hit && metaHit, 'both a GA4 copy and a Meta copy are sent');

const conversionId = recordFor(ids.a).conversion_event_id;
for (const url of [ga4Hit, metaHit]) {
  assert.match(url, /^https:\/\/kfepwkvy\.in\.stape\.io\/g\/collect\?/);
  assert.match(url, /en=generate_lead/);
  assert.match(url, /cid=783033440\.1776748220/, 'the visitor GA4 client id is preserved');
  assert.match(url, /sid=1787769945/);
  assert.match(url, new RegExp(`ep\\.event_id=${conversionId}`), 'both copies share one event id');
}

/* The GA4 copy must not carry Meta's event name, or the GA4 tag would report
   the wrong event and the container's blocking trigger would be pointless. */
assert.doesNotMatch(ga4Hit, /ep\.event_name/);
assert.match(metaHit, /ep\.event_name=Lead/);
assert.match(metaHit, /ep\.x-fb-ck-fbp=fb\.1\.a/, 'the Meta browser cookie is replayed');
assert.match(metaHit, /ep\.x-fb-ck-fbc=fb\.1\.b/);
assert.match(metaHit, /ep\.user_agent=Mozilla/, 'the visitor user agent, not Google datacentre');
assert.doesNotMatch(ga4Hit, /x-fb-ck/);

assert.equal(context.deliverPendingConversions(), 0, 'delivery is not repeated');
assert.equal(fetches.length, 2);

/* ---------------------------------------------------------------------------
   7. A browser acknowledgement suppresses the server send entirely.
   --------------------------------------------------------------------------- */
reset();
register(ids.a, { minutesAgo: 4 });
events.push(makeEvent({ id: 'evt-browser-won', createdAt: new Date(Date.now() - 3 * minute) }));
context.claimNewBookings_();
assert.equal(post({ lead_id: ids.a, action: 'conversion-reported' }).ok, true);
ageConfirmation(ids.a, 5);
assert.equal(context.deliverPendingConversions(), 0, 'the browser already fired it');
assert.equal(fetches.length, 0);

/* ---------------------------------------------------------------------------
   8. A failed send is retried on the next run rather than being lost.
   --------------------------------------------------------------------------- */
reset();
register(ids.a, { minutesAgo: 4 });
events.push(makeEvent({ id: 'evt-retry', createdAt: new Date(Date.now() - 3 * minute) }));
context.claimNewBookings_();
ageConfirmation(ids.a, 5);

failWhen = () => true;
assert.equal(context.deliverPendingConversions(), 0, 'a rejected send is not marked delivered');
failWhen = () => false;
assert.equal(context.deliverPendingConversions(), 1, 'and is retried on the next pass');
assert.equal(fetches.length, 4, 'two failed attempts, then two that stuck');

/* Partial failure is the dangerous one: retrying the copy that already landed
   would count the booking twice in GA4, which has no event-level dedupe. */
reset();
register(ids.b, { minutesAgo: 4 });
events.push(makeEvent({ id: 'evt-partial', createdAt: new Date(Date.now() - 3 * minute) }));
context.claimNewBookings_();
ageConfirmation(ids.b, 5);

failWhen = (url) => /server_meta/.test(url);
assert.equal(context.deliverPendingConversions(), 1, 'the GA4 copy lands');
assert.ok(recordFor(ids.b).server_sent_ga4_at);
assert.equal(recordFor(ids.b).server_sent_meta_at, undefined);

fetches.length = 0;
failWhen = () => false;
assert.equal(context.deliverPendingConversions(), 1);
assert.equal(fetches.length, 1, 'only the copy that failed is retried');
assert.match(fetches[0].url, /server_meta/);
assert.ok(recordFor(ids.b).server_sent_meta_at);

fetches.length = 0;
assert.equal(context.deliverPendingConversions(), 0);
assert.equal(fetches.length, 0, 'and nothing is sent once both have landed');

/* ---------------------------------------------------------------------------
   9. Status: pending, then confirmed for the page, then delivered once the
   server has taken over so the page cannot fire a duplicate.
   --------------------------------------------------------------------------- */
reset();
register(ids.a, { minutesAgo: 4 });
assert.equal(context.bookingStatus_(ids.a).status, 'pending');
events.push(makeEvent({ id: 'evt-status', createdAt: new Date(Date.now() - 3 * minute) }));
context.claimNewBookings_();
assert.equal(context.bookingStatus_(ids.a).status, 'confirmed');
assert.ok(context.bookingStatus_(ids.a).conversion_event_id);
ageConfirmation(ids.a, 5);
context.deliverPendingConversions();
assert.equal(context.bookingStatus_(ids.a).status, 'delivered', 'the page is told to stand down');
assert.equal(context.bookingStatus_(ids.a).conversion_event_id, undefined, 'and is given nothing to fire');

/* ---------------------------------------------------------------------------
   10. The status endpoint stays JSONP and leaks nothing.
   --------------------------------------------------------------------------- */
reset();
register(ids.a, { minutesAgo: 4 });
events.push(makeEvent({ id: 'evt-jsonp', createdAt: new Date(Date.now() - 3 * minute) }));
context.claimNewBookings_();
const jsonp = context.doGet({ parameter: {
  action: 'booking-status',
  lead_id: ids.a,
  callback: 'gcfoCallback'
}});
assert.equal(jsonp.mimeType, 'JAVASCRIPT');
assert.match(jsonp.text, /^gcfoCallback\(\{"ok":true,"status":"confirmed"/);
assert.doesNotMatch(jsonp.text, /booking_start|booking_event_id|matched_by/);

/* A hostile callback name is refused rather than reflected. */
const hostile = context.doGet({ parameter: {
  action: 'booking-status',
  lead_id: ids.a,
  callback: 'alert(1)//'
}});
assert.equal(hostile.mimeType, 'JSON');

/* ---------------------------------------------------------------------------
   11. Bookings far outside the window do not steal an unrelated lead.
   --------------------------------------------------------------------------- */
reset();
register(ids.a, { minutesAgo: 200 });
events.push(makeEvent({ id: 'evt-stale', createdAt: new Date(Date.now() - 1 * minute) }));
context.claimNewBookings_();
assert.equal(recordFor(ids.a).status, 'pending', 'a three-hour-old lead is not credited');

console.log('BookingVerifier.gs tests passed.');
