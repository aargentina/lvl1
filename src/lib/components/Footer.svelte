<script lang="ts">
	import { hours } from '$lib/pub';
</script>

<footer class="border-t-4 border-red bg-ink font-body text-chalk">
	<div class="px-6 py-16 lg:px-[120px]">
		<h2 class="font-display text-4xl font-black tracking-tight text-chalk lg:text-5xl">Find Us</h2>
		<div class="mt-12 grid grid-cols-1 gap-12 md:grid-cols-3">
			<!-- Address -->
			<div>
				<p class="font-heading text-[11px] uppercase tracking-[0.18em] text-red-bright">Address</p>
				<p class="mt-4 font-display text-2xl text-chalk">14 Waller St</p>
				<p class="text-chalk/50 mt-2 font-body text-base">Ottawa, ON&nbsp;&nbsp;K1N 9C4</p>
				<a
					href="https://maps.google.com/?q=14+Waller+St+Ottawa+ON"
					target="_blank"
					rel="noopener noreferrer"
					class="mt-4 inline-block font-heading text-[13px] tracking-[0.08em] text-red-bright"
				>
					Get directions →
				</a>
			</div>
			<!-- Hours -->
			<div>
				<p class="font-heading text-[11px] uppercase tracking-[0.18em] text-red-bright">Hours</p>
				<dl class="mt-4">
					{#each hours as h}
						<div class="border-chalk/10 flex justify-between border-t py-2.5">
							<dt class="text-chalk/50 font-body text-[15px]">{h.day}</dt>
							<dd class="font-body text-[15px] text-chalk">{h.time}</dd>
						</div>
					{/each}
					<div class="border-chalk/10 border-t"></div>
				</dl>
			</div>
			<!-- Contact -->
			<div>
				<p class="font-heading text-[11px] uppercase tracking-[0.18em] text-red-bright">Contact</p>
				<a
					href="tel:+16139797529"
					class="mt-4 block font-heading text-3xl tracking-tight text-chalk"
				>
					(613) 979-7529
				</a>
				<a
					href="mailto:reservations@levelonegamepub.com"
					class="text-chalk/50 mt-2 block font-body text-[15px]"
				>
					reservations@levelonegamepub.com
				</a>
			</div>
		</div>

		<!-- Bottom bar: socials + copyright -->
		<div
			class="border-chalk/10 mt-16 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"
		>
			<div class="flex gap-6">
				<a
					href="https://www.facebook.com/LevelOneGamePub"
					aria-label="Facebook"
					target="_blank"
					rel="noopener noreferrer"
					class="text-chalk/70 transition-colors hover:text-red-bright"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4z"
						/>
					</svg>
				</a>
				<a
					href="https://www.instagram.com/levelonegamepub/"
					aria-label="Instagram"
					target="_blank"
					rel="noopener noreferrer"
					class="text-chalk/70 transition-colors hover:text-red-bright"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
						/>
					</svg>
				</a>
				<a
					href="https://www.youtube.com/@leveloneandtheloft321"
					aria-label="Youtube"
					target="_blank"
					rel="noopener noreferrer"
					class="text-chalk/70 transition-colors hover:text-red-bright"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
						/>
					</svg>
				</a>
			</div>
			<p class="text-chalk/50 font-body text-sm">
				<a href="/legal" class="underline hover:text-red-bright">Privacy</a>
				<span aria-hidden="true">·</span>
				© {new Date().getFullYear()} Level One. All rights reserved.
			</p>
		</div>
	</div>
</footer>
