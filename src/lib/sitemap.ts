// Prismic pages that vercel.json permanently redirects to another page.
// Keep them out of the sitemap so Google does not see two copies of one page.
// /qr is a copy of /qrmenu (Search Console, 2026-11-26).
export const redirectedPageUids: ReadonlySet<string> = new Set(['qr']);

export function isSitemapPage(uid: string | null | undefined): uid is string {
	return Boolean(uid) && !redirectedPageUids.has(uid as string);
}
