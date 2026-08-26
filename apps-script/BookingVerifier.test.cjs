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

const leadId = '9c3273cc-d3d1-4df7-8764-5e97cc7b84ec';
const post = (parameter) => JSON.parse(context.doPost({ parameter }).text);

assert.equal(post({ lead_id: 'short', email: 'qa@example.com' }).ok, false);
assert.equal(post({ lead_id: leadId, email: '' }).ok, false);
assert.equal(values.size, 0, 'invalid registration stores nothing');

assert.equal(post({
  lead_id: leadId,
  email: 'QA.Booking@Example.com',
  track: 'business'
}).status, 'pending');
assert.equal(values.size, 1);
assert.equal(context.bookingStatus_(leadId).status, 'pending');

events.push({
  getTitle: () => 'Not the appointment schedule',
  getId: () => 'wrong-title-event',
  getDateCreated: () => new Date(),
  getGuestList: () => [{ getEmail: () => 'qa.booking@example.com' }],
  getStartTime: () => new Date(Date.now() + 86400000),
  getEndTime: () => new Date(Date.now() + 90000000)
});
assert.equal(context.syncConfirmedBookings(), 0, 'wrong event title is ignored');
assert.equal(context.isBookingTitle_('GeniusCFO Demo Call (Testing Singh)'), true);
assert.equal(context.isBookingTitle_('GeniusCFO Demo Caller'), false);

events.push({
  getTitle: () => 'GeniusCFO Demo Call (QA Booking)',
  getId: () => 'calendar-event-1',
  getDateCreated: () => new Date(),
  getGuestList: () => [{ getEmail: () => 'qa.booking@example.com' }],
  getStartTime: () => new Date(Date.now() + 86400000),
  getEndTime: () => new Date(Date.now() + 90000000)
});

assert.equal(context.syncConfirmedBookings(), 1, 'Google appointment title with booker name confirms the lead');
const status = context.bookingStatus_(leadId);
assert.equal(status.status, 'confirmed');
assert.match(status.conversion_event_id, /^gcfo_booking_[A-Za-z0-9_-]{32}$/);
assert.equal(context.syncConfirmedBookings(), 0, 'repeat scans do not duplicate confirmation');

const jsonp = context.doGet({ parameter: {
  action: 'booking-status',
  lead_id: leadId,
  callback: 'gcfoCallback'
}});
assert.equal(jsonp.mimeType, 'JAVASCRIPT');
assert.match(jsonp.text, /^gcfoCallback\(\{"ok":true,"status":"confirmed"/);

console.log('BookingVerifier.gs tests passed.');
