/**
 * GeniusCFO website — leads sheet receiver.
 *
 * Paste this into a Google Apps Script project bound to the leads
 * spreadsheet (Extensions → Apps Script from the sheet), then:
 *
 *   Deploy → New deployment → Web app
 *     Execute as:      Me
 *     Who has access:  Anyone
 *
 * Copy the resulting /exec URL into LEAD_ENDPOINT at the top of
 * assets/site.js. Redeploying mints a new URL — update the constant.
 *
 * The website posts twice per lead, both times as form-encoded fields with
 * mode:"no-cors", so the response is never read. Step 1 appends a row.
 * Step 2 finds that row by phone number and fills in the triage answers,
 * rather than writing a second row.
 *
 * Captcha: step 1 carries a Google reCAPTCHA (v2 checkbox) token as
 * `captcha_token`. When the script property RECAPTCHA_SECRET is set
 * (Project Settings → Script Properties), the token is verified with Google
 * before a row is appended. A missing token, or one Google calls invalid,
 * expired or reused, is rejected. A failure on our side (wrong secret,
 * Google unreachable) still writes the row and records why in the
 * `captcha` column, so a misconfiguration never loses a lead. Step 2 only
 * updates a row that step 1 already created, so it is not re-verified
 * (tokens are single use). Leave the property unset to skip verification.
 */

/**
 * Where the rows go.
 *
 * Leave SPREADSHEET_ID empty when the script is bound to a spreadsheet
 * (created via Extensions → Apps Script from inside the sheet) — it then
 * writes to that spreadsheet. For a standalone script project, paste the
 * spreadsheet id here: it is the long segment in the sheet's own URL,
 *
 *   https://docs.google.com/spreadsheets/d/THIS_PART/edit
 *
 * Run showSheetUrl() from the editor at any time to log which spreadsheet
 * this script is actually writing to.
 */
var SPREADSHEET_ID = '';
var SHEET_NAME = 'Leads';

var COLUMNS = [
  'received_at',
  'timestamp',
  'step',
  'name',
  'phone',
  'email',
  'company',
  'turnover',
  'role',
  'track',
  'landing_audience',
  'interested_plan',
  'challenge',
  'accounting_tool',
  'client_accounting_tool',
  'client_count',
  'whatsapp_optin',
  'whatsapp_consent_source',
  'whatsapp_consent_timestamp',
  'landing_path',
  'page',
  'referrer',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'fbclid',
  'msclkid',
  'li_fat_id',
  'captcha'
];

/* Filled in by step 2; everything else is written once by step 1. */
var STEP_TWO_COLUMNS = [
  'challenge',
  'accounting_tool',
  'client_accounting_tool',
  'client_count',
  'interested_plan',
  'step'
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var data = (e && e.parameter) || {};
    var sheet = getSheet_();
    var phone = String(data.phone || '').replace(/\D/g, '');
    var step = String(data.step || '1');

    if (step === '2' && phone) {
      var row = findRowByPhone_(sheet, phone);
      if (row) {
        updateRow_(sheet, row, data);
        return respond_({ ok: true, action: 'updated', row: row });
      }
      /* No step 1 row to update: fall through and treat it as a fresh
         submission, which means it must pass the captcha like step 1. */
    }

    var captcha = verifyCaptcha_(data.captcha_token);
    if (captcha.reject) {
      console.warn('Rejected lead (captcha %s) for phone %s', captcha.reason, phone);
      return respond_({ ok: false, error: 'captcha_' + captcha.reason });
    }
    if (!captcha.ok) {
      console.warn('Captcha could not be verified (%s); lead accepted anyway', captcha.reason);
    }
    data.captcha = captcha.ok ? captcha.reason : 'unverified: ' + captcha.reason;

    appendRow_(sheet, data);
    return respond_({ ok: true, action: 'appended' });
  } catch (err) {
    console.error(err);
    return respond_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Checks a reCAPTCHA token with Google. Returns { ok, reject, reason }.
 *
 *   ok      the token was verified (or verification is switched off)
 *   reject  the submission should be dropped: no token, or Google says the
 *           token is invalid, expired or already used — a bot, or a form
 *           posted without the checkbox
 *
 * Anything else — secret key missing or wrong, Google unreachable, script
 * not yet authorised to call external services — is our misconfiguration,
 * not the visitor's fault. Those cases return ok:false, reject:false so the
 * lead is still written, with the reason stamped in the `captcha` column
 * and logged under Executions. Dropping real leads because of a typo in a
 * script property is the one outcome this must never produce.
 */
function verifyCaptcha_(token) {
  var secret = PropertiesService.getScriptProperties().getProperty('RECAPTCHA_SECRET');
  if (!secret) return { ok: true, reject: false, reason: 'not configured' };
  if (!token) return { ok: false, reject: true, reason: 'missing token' };

  var VISITOR_ERRORS = ['invalid-input-response', 'timeout-or-duplicate'];

  try {
    var response = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'post',
      payload: { secret: String(secret).trim(), response: String(token) },
      muteHttpExceptions: true
    });
    var result = JSON.parse(response.getContentText() || '{}');
    if (result.success === true) return { ok: true, reject: false, reason: 'verified' };

    var codes = result['error-codes'] || [];
    var visitorFault = codes.length > 0 && codes.every(function (code) {
      return VISITOR_ERRORS.indexOf(code) > -1;
    });
    return { ok: false, reject: visitorFault, reason: codes.join(',') || 'failed' };
  } catch (err) {
    console.error('reCAPTCHA verification error: %s', err);
    return { ok: false, reject: false, reason: 'unavailable: ' + String(err).slice(0, 120) };
  }
}

/** A GET is only ever a human checking the deployment is alive. */
function doGet() {
  return respond_({ ok: true, service: 'geniuscfo-leads' });
}

/** Logs the spreadsheet this script writes to. Run it from the editor. */
function showSheetUrl() {
  var book = getBook_();
  var url = book.getUrl();
  console.log('Leads spreadsheet: %s\n%s', book.getName(), url);
  return url;
}

function getBook_() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);

  var book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) {
    throw new Error(
      'No spreadsheet. This script is standalone, not bound to a sheet — ' +
      'set SPREADSHEET_ID at the top of this file to the id in the target ' +
      "spreadsheet's URL, then redeploy."
    );
  }
  return book;
}

function getSheet_() {
  var book = getBook_();
  var sheet = book.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = book.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
    sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    /* Keep mobile numbers as typed rather than letting Sheets read them as
       numbers and reformat them. */
    sheet.getRange(1, COLUMNS.indexOf('phone') + 1, sheet.getMaxRows(), 1)
      .setNumberFormat('@');
  } else {
    ensureHeaders_(sheet);
  }
  return sheet;
}

/**
 * Columns added to COLUMNS after the sheet was created get their header
 * written at the end of row 1, so the values appendRow_ writes by position
 * line up with a visible heading. Existing columns are never moved.
 */
function ensureHeaders_(sheet) {
  var have = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  if (have.length >= COLUMNS.length && have[COLUMNS.length - 1] === COLUMNS[COLUMNS.length - 1]) return;
  for (var i = 0; i < COLUMNS.length; i++) {
    if (have[i] !== COLUMNS[i]) {
      sheet.getRange(1, i + 1).setValue(COLUMNS[i]).setFontWeight('bold');
    }
  }
}

function appendRow_(sheet, data) {
  var row = COLUMNS.map(function (key) {
    if (key === 'received_at') return new Date();
    return data[key] === undefined ? '' : data[key];
  });
  sheet.appendRow(row);
}

/**
 * Most recent row carrying this phone number. Searched from the bottom so a
 * returning visitor's step 2 lands on their newest submission.
 */
function findRowByPhone_(sheet, phone) {
  var last = sheet.getLastRow();
  if (last < 2) return null;

  var column = COLUMNS.indexOf('phone') + 1;
  var values = sheet.getRange(2, column, last - 1, 1).getValues();

  for (var i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]).replace(/\D/g, '') === phone) return i + 2;
  }
  return null;
}

function updateRow_(sheet, row, data) {
  STEP_TWO_COLUMNS.forEach(function (key) {
    var value = data[key];
    if (value === undefined || value === '') return;
    sheet.getRange(row, COLUMNS.indexOf(key) + 1).setValue(value);
  });
}

function respond_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
