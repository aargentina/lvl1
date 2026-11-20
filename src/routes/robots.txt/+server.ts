import { siteUrl } from '$lib/pub';

export const GET = async () => {
  const body = `User-agent: *
Allow: /
Disallow: /author/
Disallow: /wp-content/
Disallow: /wp-admin/
Disallow: /wp-json/
Disallow: /wp-includes/
Disallow: /category/
Disallow: /tag/
Disallow: /page/
Disallow: /blog/
Disallow: /pages/
Sitemap: ${siteUrl}/sitemap.xml
`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain'
    }
  });
}; 