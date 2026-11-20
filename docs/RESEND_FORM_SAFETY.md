# Website form mail checks

The Contact and Large Group Request forms use `POST /api/send-email`.
Each accepted form sends one message from `send@levelonegamepub.com` to
`levelonereservations@gmail.com`. The customer address is the `Reply-To`
address. The route sends no confirmation to the customer.

## Input checks

- The request must come from the same origin as the form page. A missing
  origin or a cross-site browser request is rejected.
- The route accepts multipart or URL-encoded form data. It reads no more
  than 131,072 body bytes, even when the request has no `Content-Length` or
  supplies a false length. Files, duplicate fields and unknown fields are
  rejected.
- Names allow Unicode text and have a 120-character limit. Email addresses
  have a 254-character limit and cannot contain mail headers. A group request
  must repeat the same email address in its confirmation field.
- Phone numbers have a 50-character limit. Organization names have a
  200-character limit. Message and additional-requirement fields each have
  a 5,000-character limit.
- Group requests need a real calendar date, a whole number of people from
  1 to 9999, and the time, game and payment choices used by the form.
- Customer text is escaped before it enters email HTML. The recipient and
  sender are fixed in server code. Provider error details are not sent to the
  customer. Logs use fixed event categories, an allowlisted provider code,
  and a numeric error status from 400 to 599 when supplied. Unknown codes
  become `unknown`; thrown send errors become `transport_error`. Each failed
  request writes one diagnostic. Logs contain no customer text, raw error,
  raw response, secret, retry key or payload hash.
- Both forms have a labelled, offscreen field that must stay blank. A filled
  field receives a quiet success response and sends no mail, including when
  it contains long text, control characters or only spaces. The bounded body,
  file, duplicate-field and unknown-field checks still run first. This is an extra
  spam check; it does not stop a caller that knows the form format.

## Repeat requests

Each browser form keeps one random submission ID until a successful result.
The server combines this ID with a hash of the final mail payload. The same
ID and payload produce the same Resend idempotency key. An edit changes the
key, so an uncertain earlier send does not prevent a corrected message.
Resend keeps these keys for 24 hours. A new successful form submission gets
a new ID. A native form post without JavaScript receives a fresh server ID, so
it can still send mail. Native posts have no repeat-request guarantee across
separate requests. A supplied invalid or duplicate ID is rejected. The
browser also blocks a second submit while its first request is in progress.

Resend 6.38.0 supplies the SDK idempotency option. The older 4.1.1 SDK did not
support that option. See [Resend idempotency keys](https://resend.com/changelog/idempotency-keys).

## Request limit

The release must include a Vercel WAF rule that matches both the exact path
`/api/send-email` and method `POST`. The planned rule allows five requests
per IP in a fixed 600-second window, then returns 429. Do not apply this
rule to other paths or methods. Read and review the active configuration
before the change; preserve other rules. The application displays a plain
error for a 429 response. Check the active rule before a mail-account move.

WAF counters are per region. They do not reserve a fixed share of the Resend
team's daily allowance. A caller can also forge an Origin header outside a
browser. Do not treat origin checks, the blank field or per-IP limits as a
proof that account-wide email use cannot reach its limit.

## Local checks

Run `npm run test:forms`. All mail data is synthetic. Tests replace the mail
client, or replace fetch while using the real installed SDK. They send no
real email. The tests check both forms, HTML escaping, header controls,
invalid and duplicate fields, files, size limits, malformed requests, origin,
the blank field, provider failures and repeat-request headers.

Run the affected format and lint checks, `npm run check`, `npm run test:menu`
and `npm run build`. Record old failures separately from new failures.
An application bundle that compiles does not prove final provider delivery.

## Planned live checks

After the checked release and WAF rule are active, submit one marked test
through each form. Use an owner-controlled reply address. Check the visible
result, the Resend receipt, Gmail delivery, fixed sender and recipient, and
the customer reply address. Use local fixtures for repeated negative tests.
Then check the dashboard mail move. Keep the old account until all required
mail paths and delivery events pass their checks.

## November 11 local check record

- All 23 synthetic form and SDK tests passed on Node 24.18.0.
- The affected source, tests and package file passed ESLint and Prettier.
  `git diff --check` passed.
- The real changed components passed a local browser check with a fake
  mail handler: one Contact request and one Group request. A mismatched
  group email disabled submission; correcting the primary address allowed
  the request. The Contact form was on the same page. No real mail was sent.
- A clean worktree at deployed source `1efe00c` and the changed worktree
  reported the same 31 type errors in 10 unchanged Prismic/Svelte files.
  Their normalized file, line, column and error text matched exactly.
  The changed form files had no type error. This is not a full type-check
  pass.
- The unchanged source and this worktree had the same failing menu leaf
  test, `New and unavailable can show together`. The runner reported 20
  passed and two failed nodes because the parent test also failed. No menu
  source or assertion was changed for this repair.
- Windows compiled the client and server bundles, but Vercel packaging
  could not create a function-directory symlink. A separate isolated
  Linux build of the earlier form repair passed with Node 24.18.0: `npm ci`, `npm run build`, and
  the Vercel adapter all completed. The final Group fix was included.
  The Linux Node archive passed the official checksum check. The existing
  optional React-email-render tracing warning remains; this route uses HTML.

## Consultation corrections

The form body limit is now 128 KiB. A native URL-encoded request with 5,000
CJK characters uses more than the former 32 KiB body limit. Tests now accept
that full textarea limit in both forms. The over-cap, streamed and false-length
checks remain in place.

`src/lib/formOptions.ts` supplies the same 18 time choices to the browser
and server. It also supplies the shared email-mismatch message. Correcting
either group email field clears a resolved mismatch, including a server
mismatch response. A count of 10000 returns the stated range error.

The package and lock metadata now require Node `24.x`. The checked live
website still uses Node 22. A preview from the final repair source must
confirm Node 24 and pass the form checks before the production merge. This
source change does not change the live project's settings. The final
isolated Linux check of these corrections passed all 23 form tests and the
complete production build. Its generated function configuration states
`nodejs24.x`. The lock comparison confirmed that only root engine metadata
changed, so the already passed clean dependency install was kept.

The final local browser check also accepted Contact and Group requests
with the shared module in place. The last time choice, 6:30 PM, was used.
The shared mismatch message appeared for different addresses and cleared
after correction. This check used the fake mail handler and sent no mail.

The live website builds from `brandonoboyle/lvl1`. The owner assigned its
repair PR merge to Brandon. Keep the Dashboard and Documents account move
on hold until that repair is live and the WAF and form delivery checks
pass. The old Resend account stays available during these checks.
