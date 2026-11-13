<script lang="ts">
	import '../app.postcss';

	import { PrismicPreview } from '@prismicio/svelte/kit';
	import { page } from '$app/stores';
	import { beforeNavigate } from '$app/navigation';
	import { crossesBookingBoundary } from '$lib/booking-navigation';
	import { repositoryName } from '$lib/prismicio';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { dev } from '$app/environment';
	import { inject } from '@vercel/analytics';
	import {
		BOOKING_ROBOTS,
		BOOKING_TITLE,
		filterBookingAnalytics,
		isBookingPath
	} from '$lib/booking-privacy';

	inject({ mode: dev ? 'development' : 'production', beforeSend: filterBookingAnalytics });

	const bookingPage = $derived(isBookingPath($page.url.pathname));
	beforeNavigate(({ from, to, willUnload, cancel }) => {
		if (from && to && !willUnload && crossesBookingBoundary(from.url, to.url)) {
			// A new document removes editor code loaded on an earlier public page.
			cancel();
			window.location.assign(to.url.href);
		}
	});

	let { children } = $props();

	const siteUrl = 'https://levelonegamepub.com';

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
			'https://www.facebook.com/LevelOneOttawa',
			'https://www.instagram.com/levelonegamepub/',
			'https://www.youtube.com/@leveloneandtheloft321'
		],
		address: {
			'@type': 'PostalAddress',
			addressLocality: 'Ottawa',
			addressRegion: 'ON',
			addressCountry: 'CA'
		},
		description: 'Board game pub and gaming community in Ottawa, Ontario.'
	};
</script>

<svelte:head>
	{#if bookingPage}
		<title>{BOOKING_TITLE}</title>
		<meta name="robots" content={BOOKING_ROBOTS} />
	{:else}
		<title>{$page.data.title}</title>
		<link rel="canonical" href="{siteUrl}{$page.url.pathname}" />

		{#if $page.data.meta_description}
			<meta name="description" content={$page.data.meta_description} />
		{/if}

		<!-- Open Graph -->
		<meta property="og:type" content="website" />
		<meta property="og:url" content="{siteUrl}{$page.url.pathname}" />
		{#if $page.data.meta_title}
			<meta property="og:title" content={$page.data.meta_title} />
		{/if}
		{#if $page.data.meta_description}
			<meta property="og:description" content={$page.data.meta_description} />
		{/if}
		{#if $page.data.meta_image}
			<meta property="og:image" content={$page.data.meta_image.url} />
		{/if}

		<!-- Twitter Card -->
		<meta name="twitter:card" content="summary_large_image" />
		{#if $page.data.meta_title}
			<meta name="twitter:title" content={$page.data.meta_title} />
		{/if}
		{#if $page.data.meta_description}
			<meta name="twitter:description" content={$page.data.meta_description} />
		{/if}
		{#if $page.data.meta_image}
			<meta name="twitter:image" content={$page.data.meta_image.url} />
		{/if}

		<!-- Structured Data: LocalBusiness + Organization -->
		<svelte:element this={'script'} type="application/ld+json"
			>{JSON.stringify(localBusinessSchema)}</svelte:element
		>
	{/if}
</svelte:head>
<div class="flex min-h-screen flex-col">
	<Header />

	<main class="flex-1 pt-16 text-chalk">{@render children?.()}</main>

	<Footer />
</div>

{#if !bookingPage}
	<PrismicPreview {repositoryName} />
{/if}
