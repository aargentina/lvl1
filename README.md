# Level One Game Pub

Website for [Level One Game Pub](https://lvl1.pub) — a game pub featuring board games, trivia, and events.

## Tech Stack

- **Framework**: SvelteKit 2 + Svelte 5
- **CMS**: Prismic (Slice Machine)
- **Styling**: Tailwind CSS + Skeleton UI
- **Deployment**: Vercel
- **Analytics**: Vercel Analytics + Speed Insights
- **Email**: Resend

## Development

```bash
npm install
npm run dev
```

`dev` runs both the Vite dev server and Slice Machine UI concurrently.

## Key Routes

| Route                | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `/`                  | Home (Prismic page)                                      |
| `/board_games`       | Board game search and catalog                            |
| `/api/menu-stock`    | Server-only proxy for the protected dashboard stock feed |
| `/api/send-email`    | Contact form email endpoint                              |
| `/api/preview`       | Prismic preview handler                                  |
| `/slice-simulator`   | Local Slice Machine simulator                            |
| `/shop`              | Live Shopify Public shop collection                      |
| `/shop/[handle]`     | Public shop product and variant selection                |
| `/shop/cart`         | Guest cart and Shopify checkout                          |
| `/bookings/[handle]` | Direct-link booking outside Public shop                  |
| `/bookings/cart`     | Separate booking cart and Shopify checkout               |

## Slices

Content slices managed via Prismic Slice Machine:

`Hero`, `HeroSmall`, `Text`, `TextCentered`, `TextColumns`, `TextWithImage`, `Image`, `ImageWithText`, `PageSplit`, `PageSplitCards`, `BgPageSplitCards`, `GridSelect`, `Video`, `Form`, `Reservation`, `LargeReso`, `MenuItems`, `Search`, `VideoGameSearch`, `GeekTriviaThemes`, `GeekTriviaScores`, `Googlemap`

## Scripts

| Command                | Description                             |
| ---------------------- | --------------------------------------- |
| `npm run dev`          | Start dev server + Slice Machine        |
| `npm run build`        | Production build                        |
| `npm run preview`      | Preview production build                |
| `npm run check`        | Type-check with svelte-check            |
| `npm run test:menu`    | Test the menu labels and stock proxy    |
| `npm run test:shop`    | Test the shop, cart and purchase checks |
| `npm run lint`         | Lint and format check                   |
| `npm run format`       | Format files                            |
| `npm run slicemachine` | Start Slice Machine UI only             |

## Shopify shop

Add public items to the manual **Public shop** collection in Shopify. The main
site reads its products, prices and availability on each request. Shopify keeps
the cart, checkout and orders. See [the shop guide](docs/SHOPIFY_SHOP.md) for the
product steps, local checks, access limits and release plan.

Edit the shop heading, intro, banner and notice in the Prismic **Shop settings**
document. Publish the document to use the changes on the next shop request.
Products, prices and stock stay in Shopify. This connection needs the website
release before it changes the live shop.

For a physical item, keep **Physical product** on and check its shipping settings.
For an event ticket, reservation or deposit with no shipment, turn **Physical
product** off. A private product also needs **Unlisted** status, Online Store
publication and no membership in **Public shop**. These settings keep its link
available without adding it to the public shop.

For a booking or deposit outside Public shop, use `/bookings/<product-handle>`.
It uses the main site's design and a separate booking cart. These pages have
no public listing or sitemap entry and ask search engines not to index them.
Anyone with the direct link can open them. Existing Shopify product links keep
working; the new main-site links need the website release before they are sent.

The Prismic Shop settings release was published on November 13, 2026. Test is
Unlisted and outside Public shop. Use `/bookings/test` for its private preview;
`/shop/test` must return 404. Public shop contains the two Blood on the Clocktower
event products. Brandon will merge the complete website PR after its checks pass.

## Live menu availability

`/food` and `/drink` show every menu item. An item that is unavailable is labeled
`Temporarily unavailable` with a diagonal stripe over a greyed photo, rather than
being removed from the page.

An item is labeled unavailable when either:

- **Toast** reports it out of stock, via the dashboard stock feed. No Prismic
  publication or site rebuild is needed; the label appears and clears on its own.
- **Prismic** has the `Temporarily unavailable` switch on. This is the manual override and it wins
  even when Toast says the item is available.

Toast items are matched to Prismic cards by their `Website Menu ID`, so renaming a
card is safe. A card with no ID yet falls back to its title, and renaming that card
does break the match until the ID is filled in — the item then shows as available
with no error, so check the ID first when a label does not appear.

Cards with the `Temporarily unavailable` switch on and no image, price, text or notes are treated as
empty Prismic placeholders and stay hidden. Give a card a price to keep it visible.

To retire an item for good, delete its card in Prismic.

### Stock feed

Set `DASHBOARD_STOCK_API_URL` and `DASHBOARD_STOCK_API_TOKEN` in Vercel Preview and
Production; see `.env.example`. The token stays on the server behind `/api/menu-stock`.

Only `/food` and `/drink` check stock. Other pages using the same `MenuItems` slice
(`/wizard`) never call the feed and never render its labels, including after a
client-side navigation away from a menu page.

Each card is matched to the stock feed by its `Website Menu ID`, a permanent value
the dashboard also uses. Cards that don't have one yet fall back to the old rule —
their title, lowercased and hyphenated — so the field can be backfilled gradually.
Once a card is linked, its ID must not change.

The page re-checks every 30 seconds while visible and keeps the last confirmed labels
if the feed fails, so an outage can never make an unavailable item look available.
Stock data older than 45 minutes is rejected as stale, and `/api/menu-stock` forwards
only `key`, `name`, `unavailable`, `isNew` and `source`.

Add `?stock-preview=1` to `/food` or `/drink` to render sample labels without calling
the feed, for reviewing the design. The server decides whether it is allowed: it works
in `npm run dev` and in Vercel Preview builds, and does nothing in production.
