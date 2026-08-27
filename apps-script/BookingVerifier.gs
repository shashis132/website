/**
 * GeniusCFO website — confirmed Google Calendar booking verifier.
 *
 * Deploy this as a standalone Apps Script web app owned by the account that
 * owns the GeniusCFO appointment schedule (marketing@geniuscfo.ai).
 *
 * WHAT THIS SERVICE IS FOR
 * Google Calendar's appointment-schedule embed is a cross-origin iframe that
 * emits nothing to the parent page when a booking completes. The Calendar
 * event it creates is therefore the only truthful signal that a booking
 * happened, and this service exists to turn that event into exactly one
 * `generate_lead` conversion.
 *
 * CORRELATION IS BY TIME ONLY.
 * Earlier versions tried to match the booker's Google account to the form's
 * name and email, and deliberately gave up when that was ambiguous — which
 * meant a booking made from a different Google account, or two bookings in the
 * same half hour, produced no conversion at all. That identity matching is
 * gone. A new booking event claims the pending lead whose Step 2 submission
 * sits nearest to it in time, and never abstains. Time is used to attribute
 * the booking to the right browser session, not to prove who booked.
 *
 * DELIVERY IS BELT AND BRACES.
 * The page polls `booking-status` and fires `generate_lead` itself when it can
 * — that is the fast path, and it carries the browser's own Meta pixel and GA4
 * identity. A visitor who closes the tab would otherwise be lost, so once a
 * booking is confirmed this service waits SERVER_BACKFILL_DELAY_MS for the
 * page to acknowledge, and if no acknowledgement arrives it sends the event
 * into the server-side GTM container itself. Exactly one of the two paths
 * delivers each booking.
 */

/** Leave blank when the appointment schedule writes to this account's primary calendar. */
var BOOKING_CALENDAR_ID = '';
var BOOKING_TITLE_KEY = 'geniuscfodemocall';
var BOOKING_LOOKBACK_DAYS = 2;
var BOOKING_LOOKAHEAD_DAYS = 120;
var LEAD_RETENTION_DAYS = 45;
var LEAD_PROPERTY_PREFIX = 'lead:';

/* A booking normally lands within a few minutes of Step 2. The window is
   generous on the "lead registered first" side because people compare slots,
   and short on the other side only to absorb clock skew between Calendar's
   creation timestamp and this script's clock. */
var CLAIM_LOOKBEHIND_MINUTES = 45;
var CLAIM_LOOKAHEAD_MINUTES = 10;

/* Server-side delivery into the GCFO server container (Stape). The GA4 client
   there claims /g/collect, so a hit shaped like the browser's own gtag request
   becomes a `generate_lead` event in the server container and fires the Meta
   Conversions API tag. */
var SGTM_COLLECT_URL = 'https://kfepwkvy.in.stape.io/g/collect';
var GA4_MEASUREMENT_ID = 'G-89VFSF4RV7';

/* How long the browser gets to report that it fired the conversion before this
   service sends it instead. Comfortably longer than the page's 5-second poll. */
var SERVER_BACKFILL_DELAY_MS = 90 * 1000;

/* A booking with no pending lead in the window — someone who used the direct
   calendar link rather than the form — still counts as a booking. Set false to
   count only bookings that came through the website funnel. */
var EMIT_UNMATCHED_BOOKINGS = true;

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var data = (e && e.parameter) || {};
    var action = String(data.action || 'register').trim();
    var leadId = String(data.lead_id || '').trim();

    if (!isValidLeadId_(leadId)) {
      return respond_({ ok: false, error: 'A valid lead ID is required.' });
    }

    var properties = PropertiesService.getScriptProperties();
    var key = leadKey_(leadId);
    var existing = parseRecord_(properties.getProperty(key));

    /* The page calls this the moment it pushes generate_lead, so the backfill
       below stands down. Losing this call costs a duplicate, not a miss, which
       is the right way round. */
    if (action === 'conversion-reported') {
      if (!existing) return respond_({ ok: false, error: 'Unknown lead.' });
      if (!existing.browser_reported_at) {
        existing.browser_reported_at = new Date().toISOString();
        properties.setProperty(key, JSON.stringify(existing));
      }
      return respond_({ ok: true, status: existing.status || 'pending' });
    }

    if (existing && existing.status === 'confirmed') {
      return respond_({ ok: true, status: 'confirmed' });
    }

    /* Identity is stored for Meta and GA4 attribution on the server path only.
       None of it is used to decide which booking belongs to which lead. */
    properties.setProperty(key, JSON.stringify({
      lead_id: leadId,
      track: String(data.track || '').trim(),
      role: String(data.role || '').trim(),
      client_id: String(data.client_id || '').trim(),
      session_id: String(data.session_id || '').trim(),
      fbp: String(data.fbp || '').trim(),
      fbc: String(data.fbc || '').trim(),
      user_agent: String(data.user_agent || '').trim(),
      page: String(data.page || '').trim(),
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
  /* A clock trigger keeps Calendar access read-only. One minute is the floor
     Apps Script allows, and it is what keeps the page's confirmation from
     feeling broken while the visitor is still looking at it. */
  ScriptApp.newTrigger('syncConfirmedBookings')
    .timeBased()
    .everyMinutes(1)
    .create();

  var matched = syncConfirmedBookings();
  console.log('Booking trigger installed for %s. Initial matches: %s', calendar.getId(), matched);
  return { calendar_id: calendar.getId(), initial_matches: matched };
}

function removeBookingTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    var handler = trigger.getHandlerFunction();
    if (handler === 'syncConfirmedBookings' || handler === 'deliverPendingConversions') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

/**
 * The single minute-by-minute job: claim new bookings, then deliver any
 * conversion the browser has not reported. Delivery runs outside the claim
 * lock so a slow UrlFetch cannot stall the next Calendar scan.
 */
function syncConfirmedBookings() {
  var matched = claimNewBookings_();
  try {
    deliverPendingConversions();
  } catch (error) {
    console.error('Conversion delivery failed: %s', error);
  }
  return matched;
}

function claimNewBookings_() {
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

      pendingRecords.push({
        key: key,
        record: record,
        requested_at: requestedAt,
        consumed: false
      });
    });

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

        var candidate = nearestPendingLead_(pendingRecords, createdAt);

        if (candidate) {
          candidate.consumed = true;
          confirmRecord_(candidate.record, event, eventId, 'time_window', 'session');
          properties.setProperty(candidate.key, JSON.stringify(candidate.record));
          console.log('Confirmed booking for %s', candidate.record.lead_id);
        } else if (EMIT_UNMATCHED_BOOKINGS) {
          var orphan = {
            lead_id: syntheticLeadId_(eventId),
            requested_at: new Date().toISOString(),
            status: 'pending'
          };
          confirmRecord_(orphan, event, eventId, 'unmatched_booking', 'unmatched');
          properties.setProperty(leadKey_(orphan.lead_id), JSON.stringify(orphan));
          console.log('Confirmed booking with no pending lead in window: %s', eventId);
        } else {
          return;
        }

        knownEventIds[eventId] = true;
        matched++;
      } catch (eventError) {
        console.error('Skipped Calendar event: %s', eventError);
      }
    });

    return matched;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Sends generate_lead for every confirmed booking the browser did not report
 * within the grace period. Marking the record before returning makes this
 * idempotent across trigger runs.
 */
function deliverPendingConversions() {
  var properties = PropertiesService.getScriptProperties();
  var stored = properties.getProperties();
  var now = Date.now();
  var sent = 0;

  Object.keys(stored).forEach(function (key) {
    if (key.indexOf(LEAD_PROPERTY_PREFIX) !== 0) return;

    var record = parseRecord_(stored[key]);
    if (!record || record.status !== 'confirmed') return;
    if (record.browser_reported_at) return;
    if (record.server_sent_ga4_at && record.server_sent_meta_at) return;

    var confirmedAt = asDate_(record.booking_confirmed_at);
    if (!confirmedAt || now - confirmedAt.getTime() < SERVER_BACKFILL_DELAY_MS) return;

    /* Each destination is tracked separately. A hit that succeeded must never
       be repeated because its partner failed — GA4 has no event-level dedupe,
       so a blind retry of both would double-count the booking. */
    var changed = false;

    if (!record.server_sent_ga4_at && sendServerHit_(record, 'ga4')) {
      record.server_sent_ga4_at = new Date().toISOString();
      changed = true;
    }
    if (!record.server_sent_meta_at && sendServerHit_(record, 'meta')) {
      record.server_sent_meta_at = new Date().toISOString();
      changed = true;
    }

    if (changed) {
      properties.setProperty(key, JSON.stringify(record));
      sent++;
    }
  });

  return sent;
}

/**
 * Shaped like the gtag hit the browser would have sent, so the server
 * container's GA4 client claims it without any new template.
 *
 * Two hits, one per destination, because they disagree about the event name.
 * The GA4 client hands `ep.event_name` to every tag in the container, and the
 * Meta Conversions API tag reads its event name from there — that is how the
 * web relay tag already talks to it. So the Meta copy has to say `Lead` while
 * the GA4 copy has to say `generate_lead`. Rather than have one hit lie to one
 * of them, each destination gets its own, and a blocking trigger in the server
 * container keeps the GA4 copy away from the Meta tag.
 *
 * `destination` is 'ga4' or 'meta'. Both carry the same event_id, so if the
 * browser did fire its pixel after all, Meta still collapses the pair.
 */
function sendServerHit_(record, destination) {
  if (!SGTM_COLLECT_URL || !GA4_MEASUREMENT_ID) return false;

  var params = {
    v: '2',
    tid: GA4_MEASUREMENT_ID,
    cid: record.client_id || syntheticClientId_(record.lead_id),
    en: 'generate_lead',
    _p: String(Date.now()),
    _et: '1',
    ngs: '1',
    'ep.event_id': String(record.conversion_event_id || ''),
    'ep.lead_id': String(record.lead_id || ''),
    'ep.booking_status': 'confirmed',
    'ep.booking_source': 'google_calendar',
    'ep.gcfo_attribution': String(record.attribution || 'session'),
    'ep.gcfo_delivery': destination === 'meta' ? 'server_meta' : 'server_ga4'
  };

  if (record.session_id) params.sid = String(record.session_id);
  if (record.page) params.dl = String(record.page);
  if (record.track) params['ep.track'] = String(record.track);
  if (record.role) params['ep.role'] = String(record.role);

  if (destination === 'meta') {
    /* The Meta event name, and the browser cookies that let Meta attribute
       this booking to the ad click that produced it. */
    params['ep.event_name'] = 'Lead';
    if (record.fbp) params['ep.x-fb-ck-fbp'] = String(record.fbp);
    if (record.fbc) params['ep.x-fb-ck-fbc'] = String(record.fbc);
    /* Without this the tag would report Google's data-centre user agent,
       because that is who is making the request. The IP cannot be corrected
       the same way — Apps Script never sees the visitor's. */
    if (record.user_agent) params['ep.user_agent'] = String(record.user_agent);
  }

  var query = Object.keys(params)
    .filter(function (key) { return params[key] !== ''; })
    .map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    })
    .join('&');

  try {
    var response = UrlFetchApp.fetch(SGTM_COLLECT_URL + '?' + query, {
      method: 'post',
      muteHttpExceptions: true,
      followRedirects: true
    });
    var code = response.getResponseCode();
    if (code >= 200 && code < 300) return true;
    console.error('Server container rejected the %s copy (%s) for %s', destination, code, record.lead_id);
    return false;
  } catch (error) {
    console.error('Server container unreachable for the %s copy: %s', destination, error);
    return false;
  }
}

function confirmRecord_(record, event, eventId, matchedBy, attribution) {
  record.status = 'confirmed';
  record.matched_by = matchedBy;
  record.attribution = attribution;
  record.booking_event_id = eventId;
  record.booking_start = event.getStartTime().toISOString();
  record.booking_end = event.getEndTime().toISOString();
  record.booking_confirmed_at = new Date().toISOString();
  record.conversion_event_id = conversionEventId_(eventId);
  return record;
}

/** Nearest Step 2 submission in time wins, most recent breaking a tie. */
function nearestPendingLead_(pendingRecords, createdAt) {
  var eligible = pendingRecords.filter(function (lead) {
    return !lead.consumed && isWithinClaimWindow_(lead.requested_at, createdAt);
  });
  if (!eligible.length) return null;

  return eligible.slice().sort(function (a, b) {
    var aDistance = Math.abs(createdAt.getTime() - a.requested_at.getTime());
    var bDistance = Math.abs(createdAt.getTime() - b.requested_at.getTime());
    if (aDistance !== bDistance) return aDistance - bDistance;
    return b.requested_at.getTime() - a.requested_at.getTime();
  })[0] || null;
}

function isWithinClaimWindow_(requestedAt, createdAt) {
  var delta = createdAt.getTime() - requestedAt.getTime();
  return delta >= -CLAIM_LOOKAHEAD_MINUTES * 60 * 1000 &&
    delta <= CLAIM_LOOKBEHIND_MINUTES * 60 * 1000;
}

function bookingStatus_(leadId) {
  var id = String(leadId || '').trim();
  if (!isValidLeadId_(id)) return { ok: false, status: 'pending' };

  var record = parseRecord_(PropertiesService.getScriptProperties().getProperty(leadKey_(id)));
  if (!record || record.status !== 'confirmed' || !record.conversion_event_id) {
    return { ok: true, status: 'pending' };
  }

  /* Once the server has delivered any part of the conversion the page must not
     fire a second one, so it is told to stop polling without being told to
     convert. */
  if (record.server_sent_ga4_at || record.server_sent_meta_at) {
    return { ok: true, status: 'delivered' };
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

function digest_(value) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(bytes).replace(/[^A-Za-z0-9_-]/g, '');
}

/** Derived from the Calendar event, so re-running never mints a second ID. */
function conversionEventId_(calendarEventId) {
  return 'gcfo_booking_' + digest_(calendarEventId).slice(0, 32);
}

function syntheticLeadId_(calendarEventId) {
  return 'orphan_' + digest_('lead:' + calendarEventId).slice(0, 32);
}

/** GA4 rejects a hit with no client ID; an unmatched booking still needs one. */
function syntheticClientId_(leadId) {
  var hash = digest_('cid:' + leadId).replace(/[_-]/g, '');
  var high = parseInt(hash.slice(0, 8).replace(/\D/g, '') || '1', 10) % 2147483647;
  return String(high || 1) + '.' + String(Math.floor(Date.now() / 1000));
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
