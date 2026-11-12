import { createClient } from '$lib/prismicio';
import type { RequestHandler } from '@sveltejs/kit';
import { predicate } from '@prismicio/client';
import { isBookingPath } from '$lib/booking-privacy';

export const GET: RequestHandler = async () => {
	try {
		// Fetch all published pages from Prismic
		const documents = await createClient().getAllByType('page', {
			// Only get published documents
			predicates: [predicate.at('document.type', 'page')]
		});

		// Base URL of your site
		const baseUrl = 'https://levelonegamepub.com';

		// Build XML with enhanced metadata
		const urls =
			documents
				.filter((doc) => doc.uid && !isBookingPath(`/${doc.uid}`))
				.map((doc) => {
					const path = doc.uid === 'home' ? '' : `/${doc.uid}`;
					const lastmod = doc.last_publication_date
						? new Date(doc.last_publication_date).toISOString()
						: new Date().toISOString();

					// Set priority based on page type (home page gets higher priority)
					const priority = doc.uid === 'home' ? '1.0' : '0.8';
					const changefreq = 'weekly'; // Adjust based on your content update frequency

					return `
      <url>
        <loc>${baseUrl}${path}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>${changefreq}</changefreq>
        <priority>${priority}</priority>
      </url>
    `;
				})
				.join('') +
			`
      <url>
        <loc>${baseUrl}/shop</loc>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
      </url>
    `;

		const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${urls}
    </urlset>
  `;

		return new Response(xml, {
			headers: {
				'Content-Type': 'application/xml',
				'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
			}
		});
	} catch (error) {
		console.error('Error generating sitemap:', error);
		return new Response('Error generating sitemap', { status: 500 });
	}
};
