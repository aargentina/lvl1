<script lang="ts">
	import { page } from '$app/stores';
	import ShopNav from '$lib/components/ShopNav.svelte';
</script>

<ShopNav scope="booking" />

<section class="mx-auto max-w-3xl px-6 py-16 font-body text-chalk lg:py-24">
	<h1 class="font-display text-4xl font-black sm:text-5xl">
		{$page.status === 404 ? 'Booking not found' : 'Booking unavailable'}
	</h1>
	<p class="text-chalk/80 mt-7 text-lg leading-8">
		{$page.status === 404
			? 'Check the booking link we sent you, or contact us for help.'
			: 'We could not check this booking. Please try again shortly.'}
	</p>
	<a
		href="/contact"
		class="mt-8 inline-flex min-h-12 items-center justify-center rounded bg-gradient-to-r from-red to-red-bright px-7 py-3 font-heading hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chalk"
		>Contact us</a
	>
</section>
