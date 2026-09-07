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

| Route              | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `/`                | Home (Prismic page)                                      |
| `/board_games`     | Board game search and catalog                            |
| `/food-live`       | Unlisted trial food menu with live Toast labels          |
| `/drink-live`      | Unlisted trial drink menu with live Toast labels         |
| `/api/menu-stock`  | Server-only proxy for the protected dashboard stock feed |
| `/api/send-email`  | Contact form email endpoint                              |
| `/api/preview`     | Prismic preview handler                                  |
| `/slice-simulator` | Local Slice Machine simulator                            |

## Slices

Content slices managed via Prismic Slice Machine:

`Hero`, `HeroSmall`, `Text`, `TextCentered`, `TextColumns`, `TextWithImage`, `Image`, `ImageWithText`, `PageSplit`, `PageSplitCards`, `BgPageSplitCards`, `GridSelect`, `Video`, `Form`, `Reservation`, `LargeReso`, `MenuItems`, `Search`, `VideoGameSearch`, `GeekTriviaThemes`, `GeekTriviaScores`, `Googlemap`

## Scripts

| Command                  | Description                         |
| ------------------------ | ----------------------------------- |
| `npm run dev`            | Start dev server + Slice Machine    |
| `npm run build`          | Production build                    |
| `npm run preview`        | Preview production build            |
| `npm run check`          | Type-check with svelte-check        |
| `npm run test:food-live` | Test the trial menu and stock proxy |
| `npm run lint`           | Lint and format check               |
| `npm run format`         | Format files                        |
| `npm run slicemachine`   | Start Slice Machine UI only         |

## Trial food menu

`/food` and `/drink` stay unchanged. `/food-live` and `/drink-live` read the same Prismic
documents and add live Toast availability and NEW labels. The trial routes are not in the
navigation or sitemap. They also use `noindex,nofollow` so search engines do not list them.

Set `DASHBOARD_STOCK_API_URL` and `DASHBOARD_STOCK_API_TOKEN` in Vercel Preview and Production.
The token stays on the server. The page checks stock every 30 seconds while it is visible. It
removes live labels after five failed checks. It also rejects stock data older than 45 minutes.
Add `?stock-preview=1` to either trial route to show sample labels during review.

The Prismic `remove_items` field is the switch labeled `86 item`. On the current menu, this switch
hides the card. On a trial menu, a named card stays visible and shows `Temporarily unavailable`.
This manual switch has priority because it remains active even when Toast reports the item as
available. Empty menu placeholders stay hidden. A named item that is no longer sold, such as Drip
Coffee, can be excluded on its trial route. `/drink-live` excludes Drip Coffee because it is
retired. If the item returns, remove `drip-coffee` from `retiredCardKeys` in
`src/routes/drink-live/+page.svelte` after review. This exclusion does not change Prismic or the
current `/drink` page.

For a real stock test, use the trial route without `?stock-preview=1`. The Vercel environment must
have both stock settings, the dashboard stock feed must be current, and the Toast item must have a
confirmed website mapping. The sample query does not call the stock feed.

On September 7, 2026, Garlic Breadsticks passed the full food test on the personal `/food-live`
deployment. Changing the Toast stock value from blank to `0` made the proxy report the item as
unavailable and the page showed `Temporarily unavailable` without a refresh command. Restoring the
Toast value made the proxy and page available again. Toast applied both stock changes after Save;
the full menu did not need publication. The drink feed still needs its separate activation and
test before `/drink-live` is ready for a live trial.

To stop the trial before merge, close this pull request or delete its branch. After merge, revert
the pull request in GitHub. This removes the trial routes and stock proxy. The existing `/food` and
`/drink` routes do not change during the trial.
