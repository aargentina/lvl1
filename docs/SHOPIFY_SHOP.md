# Public shop

The shop uses the main site's SvelteKit pages, header, footer, fonts and colors.
Shopify keeps the products, prices, stock, cart, checkout and orders.

## Add an item for public sale

1. Create or edit the product in Shopify.
2. Set the title, description, images, price and stock. Check tax and delivery settings.
3. Set the product to Active and make it available on the Online Store channel.
4. Add it to the **Public shop** collection. The collection handle is `public-shop`.

The collection is manual. A product must be added to it before the main site's
shop lists it. A product outside the collection cannot be opened or added to a
cart through the main site's shop routes. This rule does not make other Shopify
product links private.

Product and stock changes are read on the next page request. No site rebuild is
needed. The shop does not retain a product snapshot in a cache. A sold-out item
stays visible, with its add button disabled. The server checks the selected
variant again before each addition or quantity change. Shopify can reduce the
accepted quantity if stock changes during the request. The cart shows the
returned quantity and any warning.

Keep party deposits, private event payments and other direct-link items outside
this collection. The existing Toast gift card link stays in the main navigation.

## Routes and data

- `/shop` reads one page of the Public shop collection. The next-page link reads
  the next Shopify cursor.
- `/shop/[handle]` checks current collection membership, then reads the product
  and its variants.
- `/shop/cart` reads the guest cart. Its form actions add, update or remove lines
  and start Shopify checkout.
- `/shop` is included in the sitemap. Product links can be found from the shop.

Shopify requests use the fixed store `levelonegamepub.myshopify.com` and
Storefront API version `2026-10`. Basic products, collections and cart requests
use tokenless access. No Admin API key or new persistent access was created.
The live read of `public-shop` and `test` was checked on November 11, 2026.
Review the API version before Shopify retires it.

Descriptions use escaped plain text. Failed, incomplete or malformed reads
produce an unavailable state. The code does not fall back to all Shopify
products. Page reads have a ten-second request limit. Membership, variant and
cart reads have fixed page limits and reject incomplete results.

## Cart and checkout

The full Shopify cart ID contains a secret key. It stays in a server-only,
HttpOnly, SameSite=Lax cookie at `/shop`. HTTPS requests use a Secure cookie.
The cookie lasts ten days. Public page data has no root cart ID or checkout URL.
Cart pages use `Cache-Control: private, no-store`.

SvelteKit form actions keep the normal origin checks. The actions also require
an exact Origin match. Line changes must refer to the current cookie's cart.
An uncertain write is not repeated automatically. The page tells the buyer to
check the cart before another attempt.

Checkout checks current collection membership and variant availability for all
cart lines. It then reads a fresh Shopify checkout URL. The URL must use HTTPS,
the exact store host and the `/cart/` path. A native form POST follows the
external redirect. The site does not take payment or create a paid order.
Shopify checkout applies the store's current tax, delivery and payment rules.

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
the local review output.

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
any required GitHub or Vercel checks. After merge, verify the Git-triggered
production deployment for the newest main commit. Check `/shop`, `/shop/test`,
the empty cart, a product outside the collection and the phone layout. Test
must still show $100 CAD and Sold out while its stock is zero.

The live collection was created with Test as its only item. Test's price, stock
and shipping settings were not changed for these checks. A paid checkout was
not tested. A live attempt to put sold-out Test in a cart returned one stock
warning and a zero quantity. The code read the resulting empty cart back and
checked that its secret key was absent from the rendered page. Its checkout
URL used the expected Shopify host and cart path. No payment or order was made.
An available item's add, update, remove and checkout controls use local test
data until a suitable live product is approved for that check.

## Sources

- [Storefront API](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api)
- [Collections](https://help.shopify.com/en/manual/products/collections/create-collection)
- [Cart](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart/manage)
- [Checkout design](https://help.shopify.com/en/manual/checkout-settings/customize-checkout-configurations/checkout-style)
