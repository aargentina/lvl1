<script lang="ts">
	import { shopRoot, type ShopScope } from '$lib/shop';
	let { current = 'shop', scope = 'shop' }: { current?: 'shop' | 'cart'; scope?: ShopScope } =
		$props();
</script>

<nav
	aria-label={scope === 'booking' ? 'Reservation booking' : 'Shop'}
	class="border-chalk/15 border-b bg-ink font-body text-sm text-chalk"
>
	<div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 lg:px-10">
		{#if scope === 'booking'}
			<span class="font-black">Reservation booking</span>
		{:else}
			<a
				href="/shop"
				aria-current={current === 'shop' ? 'page' : undefined}
				class="inline-flex min-h-10 items-center font-black underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chalk"
			>
				Shop
			</a>
		{/if}
		<a
			href="{shopRoot(scope)}/cart"
			aria-current={current === 'cart' ? 'page' : undefined}
			class="border-chalk/50 hover:bg-chalk/10 inline-flex min-h-10 items-center gap-2 rounded border px-4 font-black transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chalk"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
				<path
					d="M6 7h15l-2 9H8L5 3H2M9 21h.01M18 21h.01"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
			{scope === 'booking' ? 'Booking cart' : 'Cart'}
		</a>
	</div>
</nav>
