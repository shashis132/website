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

const context = {
  console,
  Date,
  JSON,
  Math,
  Object,
  RegExp,
  String,
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
      forUserCalendar() { return this; },
      onEventUpdated() { return this; },
      timeBased() { return this; },
      everyMinutes() { return this; },
      create() { return this; }
    })
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

const post = (parameter) => JSON.parse(context.doPost({ parameter }).text);
const minute = 60 * 1000;
const baseTime = new Date(Date.now() - 5 * minute);

const reset = () => {
  values.clear();
  events.length = 0;
};

const recordFor = (leadId) => JSON.parse(values.get(`lead:${leadId}`));

const register = ({ leadId, name, email, requestedAt = baseTime }) => {
  const response = post({ lead_id: leadId, name, email, track: 'business' });
  assert.equal(response.status, 'pending');
  const key = `lead:${leadId}`;
  const record = JSON.parse(values.get(key));
  record.requested_at = requestedAt.toISOString();
  values.set(key, JSON.stringify(record));
  return record;
};

const makeEvent = ({
  id,
  title = 'GeniusCFO Demo Call (Calendar Booker)',
  email = 'calendar.booker@example.com',
  createdAt = new Date(baseTime.getTime() + 2 * minute)
}) => ({
  getTitle: () => title,
  getId: () => id,
  getDateCreated: () => createdAt,
  getGuestList: () => email ? [{ getEmail: () => email }] : [],
  getStartTime: () => new Date(createdAt.getTime() + 24 * 60 * minute),
  getEndTime: () => new Date(createdAt.getTime() + 25 * 60 * minute)
});

const ids = {
  wrongTitle: '11111111-1111-4111-8111-111111111111',
  email: '22222222-2222-4222-8222-222222222222',
  name: '33333333-3333-4333-8333-333333333333',
  time: '44444444-4444-4444-8444-444444444444',
  ambiguousA: '55555555-5555-4555-8555-555555555555',
  ambiguousB: '66666666-6666-4666-8666-666666666666',
  late: '77777777-7777-4777-8777-777777777777'
};

assert.equal(post({ lead_id: 'short', email: 'qa@example.com' }).ok, false);
assert.equal(post({ lead_id: ids.email, email: '' }).ok, false);
assert.equal(values.size, 0, 'invalid registration stores nothing');
assert.equal(context.isBookingTitle_('GeniusCFO Demo Call (Testing Singh)'), true);
assert.equal(context.isBookingTitle_('Genius CFO Demo Call'), true);
assert.equal(context.isBookingTitle_('GeniusCFO Demo Caller'), false);
assert.equal(context.bookingNameFromTitle_('GeniusCFO Demo Call (José D’Souza)'), 'jose d souza');

register({
  leadId: ids.wrongTitle,
  name: 'Wrong Title',
  email: 'wrong.title@example.com'
});
events.push(makeEvent({
  id: 'wrong-title-event',
  title: 'Not the appointment schedule',
  email: 'wrong.title@example.com'
}));
assert.equal(context.syncConfirmedBookings(), 0, 'wrong event title is ignored');
assert.equal(context.bookingStatus_(ids.wrongTitle).status, 'pending');

reset();
register({
  leadId: ids.email,
  name: 'Website Name',
  email: 'Exact.Email@Example.com'
});
events.push(makeEvent({
  id: 'calendar-event-email',
  title: 'GeniusCFO Demo Call (Different Name)',
  email: 'exact.email@example.com'
}));
assert.equal(context.syncConfirmedBookings(), 1, 'exact attendee email remains the strongest signal');
assert.equal(recordFor(ids.email).matched_by, 'email');
const status = context.bookingStatus_(ids.email);
assert.equal(status.status, 'confirmed');
assert.match(status.conversion_event_id, /^gcfo_booking_[A-Za-z0-9_-]{32}$/);
assert.equal(context.syncConfirmedBookings(), 0, 'repeat scans do not duplicate confirmation');

reset();
register({
  leadId: ids.name,
  name: 'Shubham Singh',
  email: 'website.form@example.com'
});
events.push(makeEvent({
  id: 'calendar-event-name',
  title: 'GeniusCFO Demo Call (Shubham  Singh)',
  email: 'personal.google@example.com'
}));
assert.equal(context.syncConfirmedBookings(), 1, 'a different Google email matches one normalized booker name');
assert.equal(recordFor(ids.name).matched_by, 'name');

reset();
register({
  leadId: ids.time,
  name: 'Website Name',
  email: 'website.only@example.com'
});
events.push(makeEvent({
  id: 'calendar-event-time',
  title: 'GeniusCFO Demo Call (Different Calendar Name)',
  email: 'different.calendar@example.com'
}));
assert.equal(context.syncConfirmedBookings(), 1, 'one recent pending lead may use the guarded fallback');
assert.equal(recordFor(ids.time).matched_by, 'unique_time_window');

reset();
register({
  leadId: ids.ambiguousA,
  name: 'Same Name',
  email: 'first@example.com'
});
register({
  leadId: ids.ambiguousB,
  name: 'Same Name',
  email: 'second@example.com',
  requestedAt: new Date(baseTime.getTime() + minute)
});
events.push(makeEvent({
  id: 'calendar-event-ambiguous',
  title: 'GeniusCFO Demo Call (Same Name)',
  email: 'third@example.com',
  createdAt: new Date(baseTime.getTime() + 3 * minute)
}));
assert.equal(context.syncConfirmedBookings(), 0, 'ambiguous name and time candidates remain pending');
assert.equal(context.bookingStatus_(ids.ambiguousA).status, 'pending');
assert.equal(context.bookingStatus_(ids.ambiguousB).status, 'pending');

reset();
register({
  leadId: ids.late,
  name: 'Late Booker',
  email: 'late@example.com'
});
events.push(makeEvent({
  id: 'calendar-event-too-late',
  title: 'GeniusCFO Demo Call (Late Booker)',
  email: 'late@example.com',
  createdAt: new Date(baseTime.getTime() + 31 * minute)
}));
assert.equal(context.syncConfirmedBookings(), 0, 'events outside the 30-minute request window are ignored');

reset();
register({
  leadId: ids.email,
  name: 'JSONP Test',
  email: 'jsonp@example.com'
});
events.push(makeEvent({
  id: 'calendar-event-jsonp',
  title: 'GeniusCFO Demo Call (JSONP Test)',
  email: 'another@example.com'
}));
assert.equal(context.syncConfirmedBookings(), 1);
const jsonp = context.doGet({ parameter: {
  action: 'booking-status',
  lead_id: ids.email,
  callback: 'gcfoCallback'
}});
assert.equal(jsonp.mimeType, 'JAVASCRIPT');
assert.match(jsonp.text, /^gcfoCallback\(\{"ok":true,"status":"confirmed"/);

console.log('BookingVerifier.gs tests passed.');
