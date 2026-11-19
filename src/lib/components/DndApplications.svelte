<script lang="ts">
	import { dev } from '$app/environment';
	import { dndApplicationHref, dndLocalReviewOrigin } from '$lib/dnd-applications';

	const localReviewOrigin = dev ? import.meta.env.VITE_DND_LOCAL_REVIEW_ORIGIN : undefined;
	const playerHref = dndApplicationHref('player', dev, localReviewOrigin);
	const dmHref = dndApplicationHref('dm', dev, localReviewOrigin);
	const reviewOrigin = dndLocalReviewOrigin(dev, localReviewOrigin);
</script>

{#if reviewOrigin}
	<aside
		aria-label="Website preview"
		class="border-chalk/20 border-b bg-ink px-5 py-3 font-body text-sm text-chalk"
	>
		<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2">
			<strong>Website preview</strong>
			<a href={playerHref} class="underline underline-offset-4">Player form</a>
			<a href={dmHref} class="underline underline-offset-4">DM form</a>
			<a href={`${reviewOrigin}/games/preview?view=groups`} class="underline underline-offset-4"
				>Alex's groups</a
			>
			<a href={`${reviewOrigin}/games/preview?view=directory`} class="underline underline-offset-4"
				>Profiles</a
			>
		</div>
	</aside>
{/if}

<section
	aria-labelledby="dnd-applications-title"
	class="bg-ink-noise px-5 py-10 text-chalk md:py-14"
>
	<div class="mx-auto max-w-6xl rounded-xl border border-white/15 bg-ink p-6 md:p-8">
		<p class="font-body text-sm uppercase tracking-widest text-ivory">Regular D&amp;D groups</p>
		<h2 id="dnd-applications-title" class="mt-3 font-heading text-3xl md:text-4xl">
			Find a group. Start an adventure.
		</h2>
		<p class="mt-4 max-w-3xl font-body text-lg leading-relaxed">
			Want to play Dungeons &amp; Dragons at Level One? Or run a game as a Dungeon Master? Use one
			of our application forms. New and experienced players are welcome.
		</p>
		<div class="mt-6 grid gap-5 md:grid-cols-2">
			<div class="rounded-lg border border-white/10 p-5">
				<h3 class="font-heading text-2xl">Join as a player</h3>
				<p class="mt-3 font-body leading-relaxed">
					Tell us about your interest in a regular D&amp;D group. The games officer will review your
					application and contact you about the next steps.
				</p>
				<a
					href={playerHref}
					class="hover:shadow-red/40 mt-5 inline-block rounded-lg bg-gradient-to-br from-red to-red-bright px-5 py-3 text-center font-heading text-lg text-chalk hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chalk"
				>
					Apply as a player
				</a>
			</div>
			<div class="rounded-lg border border-white/10 p-5">
				<h3 class="font-heading text-2xl">Run a game as a DM</h3>
				<p class="mt-3 font-body leading-relaxed">
					Want to run a regular D&amp;D group at Level One? Send us your details. The games officer
					will review your application and contact you about the next steps.
				</p>
				<a
					href={dmHref}
					class="border-chalk/70 mt-5 inline-block rounded-lg border px-5 py-3 text-center font-heading text-lg text-chalk hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chalk"
				>
					Apply as a DM
				</a>
			</div>
		</div>
		<p class="mt-6 max-w-3xl font-body leading-relaxed">
			Enter your name, email and phone number, and give permission for us to contact you. Then use
			the link in your email to verify your address. An application does not guarantee a place in a
			group.
		</p>
		<p class="mt-3 font-body text-sm text-ivory">
			Looking for a single-session game? See the one-shot events below.
		</p>
	</div>
</section>
