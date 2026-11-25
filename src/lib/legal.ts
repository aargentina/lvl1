/**
 * The one Level One policy page at /legal (owner decisions 2026-11-23 and 2026-11-24: one page,
 * minimum copy, no promises we do not need to make). Meta and other connected services link here.
 * Copy reviewed by Codex (gpt-6-astra, read-only) against the source code.
 */
export const LEGAL_CONTACT = 'info@levelonegamepub.com';

export type LegalSection = { id: string; title: string; body: string[] };

export const LEGAL_TITLE = 'Privacy and data deletion';
export const LEGAL_SECTIONS: LegalSection[] = [
	{
		id: 'privacy',
		title: 'Privacy',
		body: [
			'Level One Game Pub uses contact details, messages, orders and bookings to answer requests and run the pub. We email news and offers with your consent. Use the unsubscribe link to stop them.',
			'Our staff tools read our Facebook Page and Instagram posts, account details and activity totals. They also read Google Search Console data, public reviews and reviewer names, and our email inboxes. We use these records for reports, planning and guest service.',
			'Service providers store these records and send email for us. They may process information outside Canada, where local authorities may require access.',
			'Staff access requires sign-in and is limited by role. We keep information only as long as needed for these purposes or required by law.',
			'Our use and transfer of Google API data follow the Google API Services User Data Policy (https://developers.google.com/terms/api-services-user-data-policy), including its Limited Use requirements.'
		]
	},
	{
		id: 'other-policies',
		title: 'Applicants, employees and players',
		body: [
			'Applicant and employee privacy and text message terms: https://apply.levelonegamepub.com/legal',
			'D&D player privacy: https://players.levelonegamepub.com/legal'
		]
	},
	{
		id: 'data-deletion',
		title: 'Privacy requests and data deletion',
		body: [
			`Our owner is responsible for privacy. Email ${LEGAL_CONTACT} with questions or complaints, to withdraw consent, or to request access, correction or deletion.`
		]
	}
];

/** Split a paragraph into text and links, so that web and email addresses can be selected. */
export function linkParts(text: string): Array<{ text: string; href?: string }> {
	const parts: Array<{ text: string; href?: string }> = [];
	const pattern =
		/(https:\/\/[^\s)]+?|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})(?=[.,)]?(?:\s|$)|\))/g;
	let last = 0;
	for (const match of text.matchAll(pattern)) {
		const index = match.index ?? 0;
		if (index > last) parts.push({ text: text.slice(last, index) });
		const value = match[0];
		const email = !value.startsWith('https://');
		parts.push({ text: value.replace(/^https:\/\//, ''), href: email ? `mailto:${value}` : value });
		last = index + value.length;
	}
	if (last < text.length) parts.push({ text: text.slice(last) });
	return parts;
}
