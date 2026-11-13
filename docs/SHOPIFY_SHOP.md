# Public shop

The shop uses the main site's SvelteKit pages, header, footer, fonts and colors.
Shopify keeps the products, prices, stock, cart, checkout and orders.

## Edit the shop page in Prismic

Open the single **Shop settings** document in Prismic. Edit these four fields:

- **Heading**: the large title at the top. A blank heading uses `Shop`.
- **Intro**: the text below the heading. Leave it blank to hide it.
- **Banner**: the image behind the heading. Select an image from the Prismic
  media library. It uses the site's dark overlay so the text stays readable.
  Clear the image to hide it.
- **Notice text**: the notice above the product list. Leave it blank to hide it.

Save and publish the document. After the website release, its published values
are read on each shop request. No site rebuild is needed for these content
changes. Prismic's preview resolves this document to `/shop` and uses the
existing preview cookie. The preview endpoint must point to a website version
that contains this connection.

The `shop_settings` model is saved in `customtypes/shop_settings/index.json`.
It has one document per locale, not a page for each product. The product list,
collection heading, product images, descriptions, prices and stock still come
from Shopify. The page layout, fonts and colours stay in website code. Shop
settings do not change private booking pages or Shopify checkout.

The Shopify collection and Prismic Shop settings reads start in parallel.
The page waits for both results. It does not wait for the collection before
it starts the settings read. If settings fail, the collection description
still supplies the intro. A blank intro in an existing settings document
stays blank.

If the settings document is absent, unavailable or times out after five
seconds, the shop uses its original heading, collection intro and local banner.
An existing document with blank optional fields hides those fields. Text is
rendered as plain text, and banners must use HTTPS on a Prismic image host.

Setup on November 13, 2026: the live repository `lvl1` has the four-field
single model. The **Shop settings — 2026-11-13** release
(`avdwAhEAAMIEQly5`) was published at 15:21 ET that day. Its published document
has heading `Shop`, intro `Shop items from Level One Game Pub.`, the original
games background copied to Prismic's media library, and a blank notice.
The four published fields were read back. Its real Prismic preview also opened
the local shop and used that Prismic image. No payment or product change was
needed for those checks. Publishing this data did not release the website code.

The website's existing preview endpoint adds `/preview` to resolved routes.
For the exact Shop settings destination `/preview/shop`, it now returns `/shop`
and keeps the SDK's preview cookie and response headers. Other page previews
keep their existing destinations. After Brandon merges the website change,
check all four published fields on the live shop.

An author can also reach Shop from another Prismic page preview. GET and HEAD
requests under `/preview/shop` return to the matching `/shop` path with the query
kept. Normal Prismic page previews and form writes keep their existing routes.
The redirect uses private caching and no-index instructions.

An old Prismic preview link can expire before its callback opens. For that
specific SDK expiry error, the preview endpoint clears only the preview cookie
and returns to the published home page. It does not retry the expired token or
use a return address from the request. A valid preview callback keeps its
existing behavior. Other callback failures still report an error.

Prismic document reads have a five-second limit. A valid preview stays active.
When the SDK reports that its preview token has expired, the server clears only
the Prismic preview cookie, switches to published content and tries the read
once more under the same time limit. Other errors do not clear the cookie or
cause a preview retry. If the navigation read fails or returns invalid data,
the main menu uses fixed site links so a shop or booking page can still open.
A normal content page still needs its own Prismic content to render.

## Add an item for public sale

1. Create or edit the product in Shopify.
2. Set the title, description, images, price and stock. Check tax and delivery settings.
   For an item to be shipped, keep **Physical product** on and set its shipping
   details. For a ticket, reservation or deposit with no shipment, turn
   **Physical product** off so checkout does not ask for shipping.
3. Set the product to Active and make it available on the Online Store channel.
4. Add it to the **Public shop** collection. The collection handle is `public-shop`.

The collection is manual. A product must be added to it before the main site's
shop lists it. A product outside the collection cannot be opened or added to a
cart through the main site's shop routes. This rule does not make other Shopify
product links private.

An invalid, overlong or exhausted next-page link returns to `/shop`. A failed
first-page read still shows the shop-unavailable page. This keeps an old page
link from looking like a complete shop outage.

Product and stock changes are read on the next page request. No site rebuild is
needed. The shop does not retain a product snapshot in a cache. A sold-out item
stays visible, with its add button disabled. The server checks the selected
variant again before each addition or quantity change. Shopify can reduce the
accepted quantity if stock changes during the request. The cart shows the
returned quantity and any warning.

Keep party deposits, private event payments and other direct-link items outside
this collection. The existing Toast gift card link stays in the main navigation.

## Add event tickets

Use the public-item steps for an event that anyone can book. Create a separate
product for each event date when its price, capacity or terms differ. Put the
date, arrival time, start time, requirements and cancellation terms in its
description. Turn **Physical product** off when no item is shipped.

To limit sales to the event capacity, turn inventory tracking on, set the
available quantity and keep **Continue selling when out of stock** off. Check
the inventory location that fulfils online sales. A product with no available
stock stays visible as **Sold out**. This site does not end sales when an event
date passes. Set an old event to Draft or Archived to stop sales.

## Booking pages by direct link

Use `https://www.levelonegamepub.com/bookings/<product-handle>` for a reservation
or deposit that stays outside Public shop. The handle is the last part of its
existing Shopify `/products/<product-handle>` link. The main-site booking page
uses the same product design, header, footer, fonts and colours as the shop.
Its price, description, variants and availability come from Shopify.

These new links need this PR's main-site release. Existing Shopify links still
open their original Shopify pages. They are not redirected to the new booking
pages during local preparation.

There is no booking catalogue or public navigation link. Booking pages do not
appear in the main shop or sitemap. The server checks the complete Public shop
collection before it reads a booking by its exact handle. A public product
cannot open through the booking route. A missing, unpublished or unavailable
source is not used as proof that a product is a private booking.

Create a private reservation or deposit as follows:

1. Create or edit the product in Shopify. Set its title, description, image,
   price and available quantity. Check its tax settings.
2. Turn **Physical product** off when no item is shipped. This keeps shipping
   fields out of checkout for a cart that contains only non-physical items.
3. Set its status to **Unlisted** and keep it published to **Online Store**.
4. Keep it outside **Public shop**. No extra tag or booking collection is needed.
5. Copy its URL handle from **Search engine listing** and put it after
   `https://www.levelonegamepub.com/bookings/`. Keep the handle unchanged after
   the link is sent.

Unlisted status hides the original Shopify page from Shopify search, listings
and the Shopify sitemap. Its direct product page and checkout remain available.
Unlisted products can be read by exact handle through the Storefront API.
An available product outside Public shop can use the main-site direct-link
route. This rule does not make a booking password-protected.

Set a product to Draft or Archived to stop sales. Removing it from Public shop
alone does not stop its direct-link sale. Existing booking product settings
were kept unchanged, except for the owner-requested Test changes recorded below.

Booking pages and their data, errors and action responses use private, no-store
caching and `X-Robots-Tag: noindex, nofollow, nosnippet, noimageindex`. Their HTML
has a generic title and robots tag, with no canonical, Open Graph, Twitter or
structured-data fields. Booking analytics events are dropped. The response
uses `Referrer-Policy: strict-origin`. This sends only the site origin, with no
booking path or query, and preserves the Origin header for native form POSTs.
Do not use `no-referrer` here: it makes native POST origins null and blocks
checkout before the application handler runs.

The Prismic editor toolbar is not loaded on booking pages. Normal content and
shop pages keep it for author previews. The public cart also has no-index
instructions; its cache setting alone does not stop search indexing.
Navigation between a normal page and the booking area loads a new document.
This keeps an editor script loaded on a normal page from staying active on a
later booking page. Navigation within one area can still use the site router.

These headers apply to responses handled by the application. SvelteKit rejects
cross-origin form posts before this hook runs. That generic HTTP 403 has no
booking data. Keep the framework's origin protection enabled.

These are unlisted pages, not password-protected pages. Anyone with the URL can
open them. Their product details are sent to the person who opens the page.

The booking cart at `/bookings/cart` is separate from `/shop/cart`. It uses its
own HttpOnly cookie at `/bookings` and its own notices. Public purchases stay in
the public cart. Booking cart updates and checkout recheck that each product is
still outside Public shop and that its selected variant is available. Moving
an item between the two flows blocks the old cart's checkout until that item
is removed. Checkout still uses Shopify on `checkout.levelonegamepub.com`.

After a validated booking opens or is added, a separate HttpOnly cookie keeps
its handle for one hour at `/bookings`. The empty booking cart can then show a
return link. The server checks that the product is still available through the
private flow before it sends that link. A product moved into Public shop or a
missing product clears the saved handle. A failed source read keeps the saved
handle but sends no unchecked link. The cookie does not change a public cart.

## Routes and data

- `/shop` reads one page of the Public shop collection. The next-page link reads
  the next Shopify cursor.
- `/shop/[handle]` checks current collection membership, then reads the product
  and its variants.
- `/shop/cart` reads the guest cart. Its form actions add, update or remove lines
  and start Shopify checkout.
- `/shop` is included in the sitemap. Product links can be found from the shop.
- `/bookings/[handle]` reads one outside product by direct link only.
- `/bookings/cart` has separate cart reads, actions and checkout.

Shopify requests use the fixed store `levelonegamepub.myshopify.com` and
Storefront API version `2026-10`. Basic products, collections and cart requests
use tokenless access. No Admin API key or new persistent access was created.
The public collection and private Test route were checked on November 13, 2026.
Review the API version before Shopify retires it.

Descriptions use escaped plain text. Failed, incomplete or malformed reads
produce an unavailable state. The code does not fall back to all Shopify
products. Page reads have a ten-second request limit. Membership, variant and
cart reads have fixed page limits and reject incomplete results.

Cart checks reuse one complete collection-membership read and one product read
per handle within that request. They keep no product cache across requests.
A cart write attempt invalidates any earlier read results for that request.

## Cart and checkout

The full Shopify cart ID contains a secret key. It stays in a server-only,
HttpOnly, SameSite=Lax cookie at `/shop`. HTTPS requests use a Secure cookie.
The cookie lasts ten days. Public page data has no root cart ID or checkout URL.
Cart pages use `Cache-Control: private, no-store`.

SvelteKit form actions keep the normal origin checks. The actions also require
an exact Origin match. Line changes must refer to the current cookie's cart.
An uncertain write is not repeated automatically. The page tells the buyer to
check the cart before another attempt.

If a cart can be read but its product or membership check fails, the cart stays
visible with a temporary warning. Checkout stays blocked until a fresh check
passes. The buyer can still remove an item. A failed cart read itself still
shows an unavailable page.

Each variant can have at most 99 units in the cart. Adding the same variant
again checks its existing total before the write. An older cart above that
limit stays removable and can be reduced to a permitted quantity; it cannot
check out while its total is above the limit.

Checkout checks current collection membership and variant availability for all
cart lines. It then reads a fresh Shopify checkout URL. The URL must use HTTPS,
the exact host `levelonegamepub.myshopify.com` or `checkout.levelonegamepub.com`,
and the `/cart/` path. User information in the URL and unexpected ports are
rejected. The code uses the URL returned by Shopify without a host or path
change. A native form POST follows the
external redirect. The site does not take payment or create a paid order.
Shopify checkout applies the store's current tax, delivery and payment rules.

## Branded checkout: checked state

The prepared code accepts `checkout.levelonegamepub.com` as a checkout host.
The Storefront API endpoint stays at `levelonegamepub.myshopify.com`. The domain
and checkout settings below were checked in Shopify and the browser on
November 11, 2026. These are live Shopify settings. The main site's shop code
still needs Brandon's merge and the production check.

The approved work set has three parts: the branded checkout domain, checkout
colors and logo that match the main site, and links that return to the main
shop. Keep their current live checks and the complete release in one work set.
Brandon remains the assigned merge owner for PR 5.

Bluehost has a `checkout` CNAME to `shops.myshopify.com`, with a four-hour TTL.
The root, `www` and mail records were kept unchanged. Shopify has connected
`checkout.levelonegamepub.com` with target **Online Store**, type **Primary**
and a provisioned TLS certificate. The browser reached HTTPS checkout on this
host. The main site's domain stays at Vercel. The existing Shopify online store
also uses this primary domain; the change is not limited to the payment page.

A copy of the checkout configuration is now Active. The original June 4
configuration was preserved. The new configuration uses these settings:

- The stored white logo `logo_x2_1`, centered at 250 pixels wide.
- Header background `#191412` and header accent `#FCFCF9`.
- Main background `#FCFCF9`, accent `#A91F2C` and button `#C0212F`.
- Lato for headings and body text.
- The old banner image was removed only from the new configuration.

The browser extension's local-file setting blocked a logo upload. No workaround
was used; the existing stored white logo was selected instead.

The standard checkout logo and cart links still use Shopify's built-in
`myshopify.com` destinations. The standard editor did not provide a destination
control for them. The branding change did not change these return links.
Advanced checkout header changes require Shopify Plus.

Keep the existing Shopify theme, product forms and cart. The store also sells
direct-link deposits outside Public shop. Shopify's full redirect theme would
replace those pages, and a blanket product redirect would send excluded deposits
to a main shop page that cannot sell them. The Shopify Online Store cart and the
new main website cart are separate. Do not redirect every `/cart` request to
`/shop/cart` or replace the existing Shopify checkout button.

The draft theme `266341122104`, named
`Level One — return links draft 2026-11-11`, is a copy of active theme `96116611`.
It is not published. The saved menu `Main website return links — draft`, handle
`main-website-return-links-draft`, is assigned to this draft's **Header > Secondary
navigation**. Its links to the main website, `/shop` and `/shop/cart` were visible
in the draft preview. Active theme `96116611` is unchanged.

The draft preview kept the Add to cart forms for Test and one event ticket
outside Public shop. Its `/cart` page showed the empty Shopify cart and the
original Continue shopping link to `/collections/all`. No global redirect was
added. The local image `outputs/shop-connection/return-links-draft.jpg` records
the new menu in the draft.

Do not publish the draft until Brandon merges PR 5 and the main site's `/shop`
routes are live and checked. Then check its preview with one public item and
one item outside Public shop. The added menu links belong to Online Store pages; they
do not change built-in checkout return links or move the existing Shopify cart.

The local shop cart's native checkout form reached
`https://checkout.levelonegamepub.com` with one Test item at $100 CAD. No personal
information was entered, and no payment or order was made. After the main-site
release, check the actual logo, cart, product and Continue shopping destinations
again. Keep the standard-plan return-link limit in the release record.

Release note: the branded Shopify checkout domain and copied checkout branding
are active and were checked in the browser. The main-site shop release and
draft-theme publication still need their stated checks. The main website root
returned HTTP 200, its `/shop` returned HTTP 500 before the shop release, and
the new checkout domain root returned HTTP 200. The main shop is not live yet.
The current Shopify sales pages remain available for direct-link deposits. No
full redirect theme is part of this release.

Record the verified domain, design and return-link results separately from the
prepared source. After Brandon merges the complete PR, check the newest main
deployment and its checkout path. Do not claim that local tests prove the live
DNS, Shopify settings or production result.

## Local checks

Use Node 24 and install with `npm ci`. Run:

```text
npm run check
npm run test:menu
npm run test:shop
npm run build
```

The shop tests use local data. They cover source failures, collection membership,
sold-out variants, cart page reads, private cookies, origin checks, stock
warnings, uncertain writes, escaped text and checkout controls.

Use `npm run vite:dev -- --host 127.0.0.1 --port 4188` for local review, then open
`http://127.0.0.1:4188/shop`. The preview uses the live Public shop collection.
The email route needs the existing Resend setting for a full build. A local
build can use a non-secret test value in the process. Do not send a test email.

The repository-wide format check had 160 findings before the final changed-file
format pass. Many findings are in untouched source. Keep that limit in the PR
record. The changed source files must pass their format and ESLint checks.

On this Windows host, Vercel's adapter could compile and prerender but could not
make its function symlinks. A separate Linux Node 24.18.0 build under
`S:/Scratch/level-one-website-shop-20261111` checks the same complete source and
lockfile without a Windows permission change. Keep the final build receipt in
the local review output. Keep a source hash manifest with the build receipt.
Run the final build after the complete local change set is ready. A passed
older build does not cover later source changes.

## Release and review

The live Vercel project deploys from `brandonoboyle/lvl1`, branch `main`. The
starting source and live deployment were both commit
`1efe00cc96a692728ecec0d9a121ec8323ba2258`. Work is in the
`codex/shopify-current-site-20261111` branch of `aargentina/lvl1`.

The owner chose Brandon to merge the finished PR. The connected account has
read access to the source repository. Prepare one PR with the shop, tests,
required Svelte 5 compatibility fixes and this guide. Do not merge through the
old fork's main branch or change the Vercel Git connection.

Before merge, check the latest source main, the complete diff, local results and
any required GitHub or Vercel checks. After Brandon merges, use one check session:

1. Verify the Git-triggered production deployment for the newest source main.
   Check `/shop`, both Blood on the Clocktower event pages, the public cart and
   the phone layout. The public shop must list the two event products and omit
   Test. `/shop/test` must return 404. Do not add a real event ticket for this
   Test check.
2. Check the published Prismic heading, intro, banner and hidden blank notice.
   Check a normal content preview and its Shop navigation. Check that an expired
   preview can return to published content without a page error.
3. Open `/bookings/test`. It must show $100 CAD and current availability. Check
   its generic page metadata, no-index/no-store headers and public shop/sitemap
   exclusion. Check that its original Shopify product link still works.
4. Use the private Test flow to add one, update to two, follow the native checkout
   redirect and remove only the Test cart item. Confirm HTTPS on
   `checkout.levelonegamepub.com` and that the cart key is absent from page data.
   A cart with only this non-physical reservation must not ask for delivery or
   shipping. Do not enter personal information, make a payment or submit an order.
5. Check the three new menu links in the draft theme after their main-site
   routes are live. Keep the draft unpublished until these checks pass. Record
   any later theme publication and verify the active theme and return links.

Historical checks: the live collection was first created with Test as its only
item. The owner approved
stock of five for Test so the available-item flow could be checked. The live
checks added one Test item, updated the quantity to two, opened checkout and
removed the item. The later branded-domain browser check used one Test item at
$100 CAD. Test's price and shipping settings were kept unchanged. No personal
information, payment or order was submitted.

A fresh independent cart check after the domain change also passed: add one,
update to two, receive the checkout HTTP 303 with host
`checkout.levelonegamepub.com`, remove the item, and read an empty cart. The
private cart key was absent from the returned page data. Its local receipt is
`outputs/shop-connection/branded-cart-check.json`.

The earlier sold-out check used zero stock. Shopify returned one stock warning
and a zero quantity. The code read the resulting empty cart back and checked
that its secret key was absent from the rendered page. This remains the
sold-out test evidence; it is not Test's current stock setting.

The owner later added the Advanced November 22 and Beginner November 29 Blood
on the Clocktower products to Public shop. Both event pages and their $20.34 CAD
prices were checked in the local preview. Their prices, stock and shipping were
unchanged.

Current Test state, November 13, 2026: Test is **Unlisted** and was removed from
Public shop at the owner's request. Public shop now contains only the two
Clocktower products. The public Test URL returns 404. Its private
`/bookings/test` page returns 200 with the main design, $100 CAD price and private
page headers. Test has five available units at 14 Waller Street. A private cart
check passed: add one, update to two, update back to one, open the branded
checkout and remove Test to leave the private cart empty. No order was placed.

The owner also requested that Test be a reservation with no shipment. On
November 13, the Shopify Admin API read back
`inventoryItem.requiresShipping: false` for Test. Its price, available quantity,
Unlisted status and collection exclusion were kept. This saved setting is not
proof of the hosted checkout behavior. Use one Test in the private cart to check
that branded checkout has no delivery or shipping fields, without placing an
order. Keep that browser result with the local check receipts.

## Sources

- [Storefront API](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api)
- [Collections](https://help.shopify.com/en/manual/products/collections/create-collection)
- [Cart](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart/manage)
- [Checkout design](https://help.shopify.com/en/manual/checkout-settings/customize-checkout-configurations/checkout-style)
- [Checkout subdomain and redirect theme](https://shopify.dev/docs/storefronts/hydrogen/deploy/go-live)
- [Connect a subdomain](https://help.shopify.com/en/manual/domains/add-a-domain/connecting-domains/connect-subdomain)
- [Primary domain behavior](https://help.shopify.com/en/manual/domains/domain-type/change-primary-domain)
- [Shopify redirect theme](https://github.com/Shopify/hydrogen-redirect-theme)
- [Checkout logo controls](https://shopify.dev/docs/api/admin-graphql/latest/objects/CheckoutBrandingLogo)
- [Checkout cart link controls](https://shopify.dev/docs/api/admin-graphql/latest/objects/CheckoutBrandingCartLink)
- [Checkout header extension and plan limit](https://shopify.dev/docs/apps/build/checkout/customize-header?extension=polaris)
- [Unlisted products and direct Storefront API reads](https://shopify.dev/docs/apps/build/product-merchandising/unlisted-products)
