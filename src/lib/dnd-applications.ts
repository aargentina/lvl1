type ApplicationRole = 'player' | 'dm';

export function dndLocalReviewOrigin(
	development: boolean,
	localReviewOrigin?: string
): string | undefined {
	if (!development || !localReviewOrigin) return undefined;
	try {
		const url = new URL(localReviewOrigin);
		if (
			url.protocol !== 'http:' ||
			!['127.0.0.1', 'localhost'].includes(url.hostname) ||
			url.username ||
			url.password ||
			url.pathname !== '/' ||
			url.search ||
			url.hash
		)
			return undefined;
		return url.origin;
	} catch {
		return undefined;
	}
}

/** Local review uses synthetic forms. Production always uses the public forms. */
export function dndApplicationHref(
	role: ApplicationRole,
	development: boolean,
	localReviewOrigin?: string
): string {
	const reviewOrigin = dndLocalReviewOrigin(development, localReviewOrigin);
	return reviewOrigin
		? `${reviewOrigin}/games/preview?view=join-${role}`
		: `https://level-one-dashboard.vercel.app/games/join/${role}`;
}
