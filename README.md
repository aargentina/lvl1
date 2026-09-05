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
| `/api/send-email`  | Contact form email endpoint                              |
| `/api/menu-stock`  | Server-only proxy for the protected dashboard stock feed |
| `/api/preview`     | Prismic preview handler                                  |
| `/slice-simulator` | Local Slice Machine simulator                            |

## Slices

Content slices managed via Prismic Slice Machine:

`Hero`, `HeroSmall`, `Text`, `TextCentered`, `TextColumns`, `TextWithImage`, `Image`, `ImageWithText`, `PageSplit`, `PageSplitCards`, `BgPageSplitCards`, `GridSelect`, `Video`, `Form`, `Reservation`, `LargeReso`, `MenuItems`, `Search`, `VideoGameSearch`, `GeekTriviaThemes`, `GeekTriviaScores`, `Googlemap`

## Scripts

| Command                | Description                      |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Start dev server + Slice Machine |
| `npm run build`        | Production build                 |
| `npm run preview`      | Preview production build         |
| `npm run check`        | Type-check with svelte-check     |
| `npm run lint`         | Lint and format check            |
| `npm run format`       | Auto-format with Prettier        |
| `npm run slicemachine` | Start Slice Machine UI only      |

## Live menu stock

Set `DASHBOARD_STOCK_API_URL` and `DASHBOARD_STOCK_API_TOKEN` in Vercel for
Preview and Production. The token stays on the server. The food page checks
stock every 30 seconds while the page is visible. It removes all live
unavailable labels after five failed checks. It also treats a stock snapshot
older than 45 minutes as a failed check.

## Menu type repair

This branch covers the food and bar menu pages. The shared Prismic library uses
the Svelte 5-compatible v2 API. Both rich-text wrappers use
`ComponentProps<typeof PrismicRichText>` for that API.

The menu repair passed 19 local server-rendering checks for menu text, prices,
links, section order, and unavailable-item labels. Production compilation and
prerender also passed with local sample menu data and external network access
blocked. These checks did not test browser polling or production data.

The full `npm run check` reports five errors outside this repair: one in
`HeroSmall`, one in `Video`, two on the home page, and one in the slice simulator.
There are no reported errors in the food or drink routes or their menu components.
