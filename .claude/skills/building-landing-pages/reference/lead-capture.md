# Lead capture: the form and the receiver

The lead form is markup-driven. One implementation in `assets/site.js` serves
every page, and the markup decides which variant a page gets. That is why
*deleting* a field is not how you remove it: the shared code still asks for it
by name.

A submission travels: form → `LEAD_ENDPOINT` (a Google Apps Script web app) →
the Leads sheet. Business visitors then leave for Razorpay; firms book a
Cal.com demo instead.

**Contents:** [What the markup decides](#what-the-markup-decides) · [Removing a field](#removing-a-field) · [Removing the booking step](#removing-the-booking-step) · [The ₹9 route](#the-9-route) · [The receiver, and the way it loses leads](#the-receiver-and-the-way-it-loses-leads) · [Deploying a receiver change](#deploying-a-receiver-change) · [What cannot be tested from the sandbox](#what-cannot-be-tested-from-the-sandbox)

## What the markup decides

| Attribute | Effect |
|---|---|
| `data-lead-form` | Marks the root. Required. |
| `data-lead-track="business"` | Labels the lead's source in the sheet and the data layer. |
| `data-lead-payment` on a step-3 panel | This page offers the ₹9 Razorpay route. |
| `data-lead-payment-only` on the root | Every role takes the Razorpay route, including firms. Use when the page has no booking panel. |
| `data-lead-route="payment"` / `"booking"` | Which step-3 panel belongs to which route. A panel with neither belongs to both. |
| `data-captcha` | reCAPTCHA renders here. **Absent means no captcha** — see the receiver, below. |
| `data-chip-group="role"` | The role chips. The `data-chip-value` drives logic; the label is free text. |
| `data-turnover-field` | Hidden automatically for firm roles. |

## Removing a field

`site.js` validates `name`, `company`, `phone`, `email`, `role`, `turnover` and
`consent`. Its `value()` helper returns `""` for an input that is not in the
DOM, so a validation rule that is not guarded treats an absent field as an
empty one: **validation fails forever, against an error node that no longer
exists, and the submit button silently does nothing.**

`company`, `email` and `turnover` are guarded — each check runs only when
`field(name)` finds the input, so removing the markup removes the requirement.
`name`, `phone`, `role` and `consent` are not guarded and are always required.

To remove `name`, `phone`, `role` or `consent`, add the same guard first.

## Removing the booking step

`route()` sends any firm role (`ca_firm`, `cfo_firm`) to the booking panel. A
page with no booking panel routes into nothing and the visitor sees a dead
form. Put `data-lead-payment-only` on the form root so every role takes the
payment route.

## The ₹9 route

The lead POST uses `keepalive`, because the page leaves for Razorpay about half
a second after submit. **Do not remove that flag.**

`generate_lead` comes only from a Cal.com booking, so a business lead does not
raise it. The page pushes `lead_payment_redirect` just before leaving; the
payment happens on Razorpay and the sign-up in the app, neither of which this
site can see. Counting a paid trial as a conversion is a GTM change.

## The receiver, and the way it loses leads

`apps-script/Code.gs` runs as a Google Apps Script web app. Its captcha rule:

```js
if (!secret) return { ok: true,  reject: false, reason: 'not configured' };
if (!token)  return { ok: false, reject: true,  reason: 'missing token' };
```

`reject: true` **drops the row**. With `RECAPTCHA_SECRET` set — it is — a page
that posts no captcha token loses every lead it ever takes, silently: no row,
no error, nothing to notice.

So a page with no captcha must be named in `CAPTCHA_EXEMPT_PATHS`, matched
against the `landing_path` the form posts. Those rows are written and stamped
`not required` in the `captcha` column, so the sheet still shows which rows
were never challenged.

Everything else about that rule is deliberate and must stay: a failure on *our*
side — wrong secret, Google unreachable, the script not yet authorised for
external requests — writes the row anyway and records why. A real lead was lost
once by failing closed on a configuration error.

### Deploying a receiver change

A `Code.gs` edit does nothing until the deployment is updated. Click path for
Shashi, who does not use a terminal:

1. the Leads Google Sheet → **Extensions** → **Apps Script**
2. replace the contents of `Code.gs`, click **save**
3. **Deploy** → **Manage deployments** → the **pencil** icon
4. Version: **New version** → **Deploy**

Step 4 is the one that applies it. Only a brand-new deployment mints a new
`/exec` URL, so this keeps `LEAD_ENDPOINT` unchanged.

**Sequence matters.** If the page ships before the receiver is redeployed,
leads are lost in the gap. Say so plainly when handing back.

Adding `UrlFetchApp` to a script whose owner only authorised Sheets leaves the
web app unable to reach Google. Running `checkCaptchaSetup` from the editor
once triggers the consent screen and reports whether the secret is accepted.

## What cannot be tested from the sandbox

The network policy blocks `google.com`, `script.google.com`, `rzp.io` and
`cal.com`. So:

- the captcha never renders locally; its console error is expected
- the Razorpay hand-off is verified by intercepting the navigation in
  Playwright (`page.route("https://rzp.io/**", …)`), which proves the page
  tries to go to the right URL
- `site.js` suppresses the lead POST entirely on localhost, so browser QA
  cannot write junk rows into the live sheet

The live captcha, the real payment page and the sheet row are verified by
Shashi doing one real submission and reading the `captcha` column.
