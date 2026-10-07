// How long a menu card keeps its NEW tag after its "New since" date in Prismic.
export const NEW_DAYS = { food: 60, drink: 14 } as const;

const DAY_MS = 24 * 60 * 60 * 1000;

// `newSince` is a Prismic date ("YYYY-MM-DD"). The tag shows on that day and for
// the next `days - 1` days, then disappears. A date in the future shows nothing yet.
export function isNewWithin(newSince: string | null, days: number, now: number): boolean {
	if (!newSince) return false;
	const start = Date.parse(`${newSince.slice(0, 10)}T00:00:00Z`);
	if (!Number.isFinite(start)) return false;
	const today = new Date(now);
	const todayStart = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
	const age = Math.floor((todayStart - start) / DAY_MS);
	return age >= 0 && age < days;
}
