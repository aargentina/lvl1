<script lang="ts">
	import '../app.postcss';

	import { PrismicPreview } from '@prismicio/svelte/kit';
	import { page } from '$app/stores';
	import { hours, siteUrl } from '$lib/pub';
	import { repositoryName } from '$lib/prismicio';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { dev } from '$app/environment';
	import { inject } from '@vercel/analytics';

	inject({ mode: dev ? 'development' : 'production' });

	let { children } = $props();

	const pageTitle = $derived(
		$page.data.meta_title?.trim() || $page.data.title?.trim() || 'Level One Game Pub'
	);

	const localBusinessSchema = {
		'@context': 'https://schema.org',
		'@type': 'LocalBusiness',
		'@id': `${siteUrl}/#localbusiness`,
		name: 'Level One Game Pub',
		url: siteUrl,
		telephone: '+1-613-979-7529',
		email: 'info@levelonegamepub.com',
		image: `${siteUrl}/icon.png`,
		sameAs: [
			'https://www.facebook.com/LevelOneGamePub',
			'https://www.instagram.com/levelonegamepub/',
			'https://www.youtube.com/@leveloneandtheloft321'
		],
		address: {
			'@type': 'PostalAddress',
			streetAddress: '14 Waller St',
			postalCode: 'K1N 9C4',
			addressLocality: 'Ottawa',
			addressRegion: 'ON',
			addressCountry: 'CA'
		},
		openingHoursSpecification: hours.map(({ days, opens, closes }) => ({
			'@type': 'OpeningHoursSpecification',
			dayOfWeek: days,
			opens,
			closes
		})),
		description: 'Board game pub and gaming community in Ottawa, Ontario.'
	};
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<link rel="canonical" href="{siteUrl}{$page.url.pathname}" />

	{#if $page.data.meta_description}
		<meta name="description" content={$page.data.meta_description} />
	{/if}

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{siteUrl}{$page.url.pathname}" />
	<meta property="og:title" content={pageTitle} />
	{#if $page.data.meta_description}
		<meta property="og:description" content={$page.data.meta_description} />
	{/if}
	{#if $page.data.meta_image}
		<meta property="og:image" content={$page.data.meta_image.url} />
	{/if}

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={pageTitle} />
	{#if $page.data.meta_description}
		<meta name="twitter:description" content={$page.data.meta_description} />
	{/if}
	{#if $page.data.meta_image}
		<meta name="twitter:image" content={$page.data.meta_image.url} />
	{/if}

	<!-- Structured Data: LocalBusiness + Organization -->
	{@html `<script type="application/ld+json">${JSON.stringify(localBusinessSchema)}</script>`}
</svelte:head>
<div class="flex min-h-screen flex-col">
	<Header />

	<main class="flex-1 pt-16 text-chalk">{@render children?.()}</main>

	<Footer />
</div>

<PrismicPreview {repositoryName} />
