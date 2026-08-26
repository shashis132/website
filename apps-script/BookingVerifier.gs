/**
 * GeniusCFO website — confirmed Google Calendar booking verifier.
 *
 * Deploy this as a standalone Apps Script web app owned by the account that
 * owns the GeniusCFO appointment schedule (marketing@geniuscfo.ai).
 *
 * The existing GCFO leads receiver remains responsible for the linked Google
 * Sheet. This service stores only short-lived lead correlation signals,
 * watches Calendar for a real appointment event, and exposes a non-sensitive
 * status for the website to poll.
 */

/** Leave blank when the appointment schedule writes to this account's primary calendar. */
var BOOKING_CALENDAR_ID = '';
var BOOKING_TITLE_KEY = 'geniuscfodemocall';
var BOOKING_LOOKBACK_DAYS = 2;
var BOOKING_LOOKAHEAD_DAYS = 120;
var BOOKING_REQUEST_GRACE_MINUTES = 10;
var BOOKING_MATCH_WINDOW_MINUTES = 30;
var LEAD_RETENTION_DAYS = 45;
var LEAD_PROPERTY_PREFIX = 'lead:';

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var data = (e && e.parameter) || {};
    var leadId = String(data.lead_id || '').trim();
    var email = normalizeEmail_(data.email);
    var nameKey = normalizePersonName_(data.name);

    if (!isValidLeadId_(leadId) || !isValidEmail_(email)) {
      return respond_({ ok: false, error: 'A valid lead ID and email are required.' });
    }

    var properties = PropertiesService.getScriptProperties();
    var key = leadKey_(leadId);
    var existing = parseRecord_(properties.getProperty(key));
    if (existing && existing.status === 'confirmed') {
      return respond_({ ok: true, status: 'confirmed' });
    }

    properties.setProperty(key, JSON.stringify({
      lead_id: leadId,
      email: email,
      name_key: nameKey,
      track: String(data.track || '').trim(),
      requested_at: new Date().toISOString(),
      status: 'pending'
    }));

    return respond_({ ok: true, status: 'pending' });
  } catch (error) {
    console.error(error);
    return respond_({ ok: false, error: String(error) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * booking-status uses JSONP because the web app is cross-origin. It returns no
 * contact details, Calendar event ID, or appointment time.
 */
function doGet(e) {
  var params = (e && e.parameter) || {};
  if (String(params.action || '') === 'booking-status') {
    return respond_(bookingStatus_(params.lead_id), params.callback);
  }
  return respond_({ ok: true, service: 'geniuscfo-booking-verifier' });
}

/** Run once after deploying this version. Safe to run again. */
function installBookingTriggers() {
  removeBookingTriggers();

  var calendar = getBookingCalendar_();
  /* A clock trigger keeps Calendar access read-only. */
  ScriptApp.newTrigger('syncConfirmedBookings')
    .timeBased()
    .everyMinutes(5)
    .create();

  var matched = syncConfirmedBookings();
  console.log('Booking trigger installed for %s. Initial matches: %s', calendar.getId(), matched);
  return { calendar_id: calendar.getId(), initial_matches: matched };
}

function removeBookingTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'syncConfirmedBookings') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

/**
 * Appointment schedules create Calendar events. The schedule title must match.
 * Correlation then uses, in order: attendee email, one unambiguous normalized
 * booker-name match, or one unambiguous lead in the short request-time window.
 * Ambiguous events remain unmatched, so no conversion is emitted by guessing.
 */
function syncConfirmedBookings() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var properties = PropertiesService.getScriptProperties();
    var stored = properties.getProperties();
    var now = new Date();
    var expiry = now.getTime() - LEAD_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    var pendingRecords = [];
    var knownEventIds = {};

    Object.keys(stored).forEach(function (key) {
      if (key.indexOf(LEAD_PROPERTY_PREFIX) !== 0) return;
      var record = parseRecord_(stored[key]);
      var requestedAt = record && asDate_(record.requested_at);

      if (!record || !requestedAt || requestedAt.getTime() < expiry) {
        properties.deleteProperty(key);
        return;
      }

      if (record.booking_event_id) knownEventIds[String(record.booking_event_id)] = true;
      if (record.status === 'confirmed') return;

      var email = normalizeEmail_(record.email);
      if (!isValidEmail_(email)) return;
      pendingRecords.push({
        key: key,
        record: record,
        requested_at: requestedAt,
        email: email,
        name_key: normalizePersonName_(record.name_key || record.name),
        consumed: false
      });
    });

    pendingRecords.sort(function (a, b) {
      return b.requested_at.getTime() - a.requested_at.getTime();
    });

    if (!pendingRecords.length) return 0;

    var calendar = getBookingCalendar_();
    var rangeStart = new Date(now.getTime() - BOOKING_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    var rangeEnd = new Date(now.getTime() + BOOKING_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
    var events = calendar.getEvents(rangeStart, rangeEnd);
    var matched = 0;

    events.forEach(function (event) {
      try {
        if (!isBookingTitle_(event.getTitle())) return;

        var eventId = String(event.getId() || '');
        if (!eventId || knownEventIds[eventId]) return;

        var createdAt = asDate_(event.getDateCreated());
        if (!createdAt) return;

        var eligible = pendingRecords.filter(function (lead) {
          return !lead.consumed && isWithinBookingWindow_(lead.requested_at, createdAt);
        });
        if (!eligible.length) return;

        var guestEmails = {};
        var guests = event.getGuestList() || [];
        guests.forEach(function (guest) {
          var guestEmail = normalizeEmail_(guest.getEmail());
          if (isValidEmail_(guestEmail)) guestEmails[guestEmail] = true;
        });

        var candidate = null;
        var matchedBy = '';
        var emailMatches = eligible.filter(function (lead) {
          return !!guestEmails[lead.email];
        });

        if (emailMatches.length) {
          candidate = closestCandidate_(emailMatches, createdAt);
          matchedBy = 'email';
        }

        if (!candidate) {
          var bookingName = bookingNameFromTitle_(event.getTitle());
          var nameMatches = bookingName ? eligible.filter(function (lead) {
            return lead.name_key && lead.name_key === bookingName;
          }) : [];

          if (nameMatches.length === 1) {
            candidate = nameMatches[0];
            matchedBy = 'name';
          }
        }

        if (!candidate && eligible.length === 1) {
          candidate = eligible[0];
          matchedBy = 'unique_time_window';
        }
        if (!candidate) return;

        candidate.consumed = true;
        candidate.record.status = 'confirmed';
        candidate.record.matched_by = matchedBy;
        candidate.record.booking_event_id = eventId;
        candidate.record.booking_start = event.getStartTime().toISOString();
        candidate.record.booking_end = event.getEndTime().toISOString();
        candidate.record.booking_confirmed_at = new Date().toISOString();
        candidate.record.conversion_event_id = conversionEventId_(eventId);
        properties.setProperty(candidate.key, JSON.stringify(candidate.record));

        knownEventIds[eventId] = true;
        matched++;
        console.log('Confirmed booking for %s via %s', candidate.record.lead_id, matchedBy);
      } catch (eventError) {
        console.error('Skipped Calendar event: %s', eventError);
      }
    });

    return matched;
  } finally {
    lock.releaseLock();
  }
}

function bookingStatus_(leadId) {
  var id = String(leadId || '').trim();
  if (!isValidLeadId_(id)) return { ok: false, status: 'pending' };

  var record = parseRecord_(PropertiesService.getScriptProperties().getProperty(leadKey_(id)));
  if (!record || record.status !== 'confirmed' || !record.conversion_event_id) {
    return { ok: true, status: 'pending' };
  }

  return {
    ok: true,
    status: 'confirmed',
    conversion_event_id: String(record.conversion_event_id)
  };
}

function leadKey_(leadId) {
  return LEAD_PROPERTY_PREFIX + leadId;
}

function parseRecord_(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch (error) { return null; }
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePersonName_(value) {
  var name = String(value || '').trim().toLowerCase();
  if (!name) return '';
  try { name = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''); } catch (error) { /* older runtime */ }
  return name.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function isValidLeadId_(leadId) {
  return /^[A-Za-z0-9_-]{16,100}$/.test(leadId);
}

function normalizeBookingTitle_(title) {
  return String(title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isBookingTitle_(title) {
  var value = String(title || '').trim();
  if (normalizeBookingTitle_(value) === BOOKING_TITLE_KEY) return true;

  /* Google appointment schedules append the booker's name in parentheses. */
  return /^Genius\s*CFO\s+Demo\s+Call\s+\([^()]+\)$/i.test(value);
}

function bookingNameFromTitle_(title) {
  var match = /^Genius\s*CFO\s+Demo\s+Call\s+\(([^()]+)\)$/i.exec(String(title || '').trim());
  return match ? normalizePersonName_(match[1]) : '';
}

function isWithinBookingWindow_(requestedAt, createdAt) {
  var delta = createdAt.getTime() - requestedAt.getTime();
  return delta >= -BOOKING_REQUEST_GRACE_MINUTES * 60 * 1000 &&
    delta <= BOOKING_MATCH_WINDOW_MINUTES * 60 * 1000;
}

function closestCandidate_(candidates, createdAt) {
  return candidates.slice().sort(function (a, b) {
    var aDistance = Math.abs(createdAt.getTime() - a.requested_at.getTime());
    var bDistance = Math.abs(createdAt.getTime() - b.requested_at.getTime());
    if (aDistance !== bDistance) return aDistance - bDistance;
    return b.requested_at.getTime() - a.requested_at.getTime();
  })[0] || null;
}

function asDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return value;
  if (!value) return null;
  var date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function getBookingCalendar_() {
  var calendar = BOOKING_CALENDAR_ID
    ? CalendarApp.getCalendarById(BOOKING_CALENDAR_ID)
    : CalendarApp.getDefaultCalendar();
  if (!calendar) throw new Error('Booking calendar was not found. Check BOOKING_CALENDAR_ID.');
  return calendar;
}

function conversionEventId_(calendarEventId) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(calendarEventId),
    Utilities.Charset.UTF_8
  );
  return 'gcfo_booking_' + Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '').slice(0, 32);
}

function respond_(payload, callback) {
  var json = JSON.stringify(payload);
  var safeCallback = String(callback || '').trim();
  if (/^[A-Za-z_$][0-9A-Za-z_$]{0,80}$/.test(safeCallback)) {
    return ContentService
      .createTextOutput(safeCallback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
