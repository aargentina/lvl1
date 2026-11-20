# Regular D&D applications

The public `/dnd` page has two links:

- Apply as a player: `https://players.levelonegamepub.com/?role=player` (the Level One player portal)
- Apply as a DM: `https://players.levelonegamepub.com/?role=dm`

Each link opens a full page. The dashboard collects the application, verifies the
email address and stores the record for the games officer. The website does
not collect or send application details. It needs no new secret or API route.
The existing contact form and Shopify checkout have no changes.

The new section applies only to the Prismic page with UID `dnd`. Prismic still
supplies the page content and event links. Its current text also offers contact
by email. The games officer can update that text in Prismic when the forms are
live. The email address can remain as a way to ask for help.

Before the website release, the dashboard release must have both public forms
and the email verification flow in service. Check both links from the public
website after release. Do not send test applications to real customers or staff.

Local checks: `npm run test:dnd`, `npm run check`, and `npm run build`.
The D&D test uses local page data. It makes no service calls.

For a local review of the full website, set `VITE_DND_LOCAL_REVIEW_ORIGIN` to
`http://127.0.0.1:3107` in the dev-server process. Then open `/dnd`. Its buttons
open the synthetic dashboard form previews. Only development builds can use
this setting, and only HTTP loopback origins are accepted. Production builds
always use the canonical public form links above.
