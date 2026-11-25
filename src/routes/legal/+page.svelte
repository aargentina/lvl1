<script lang="ts">
	import { LEGAL_SECTIONS, LEGAL_TITLE, linkParts } from '$lib/legal';
</script>

<article class="bg-ink-noise px-5 py-12 font-body text-chalk">
	<div class="mx-auto max-w-3xl">
		<h1 class="font-display text-4xl font-bold">{LEGAL_TITLE}</h1>

		{#each LEGAL_SECTIONS as section (section.id)}
			<section id={section.id} class="mt-8 scroll-mt-24">
				<h2 class="font-heading text-2xl">{section.title}</h2>
				{#each section.body as paragraph (paragraph)}
					<p class="text-chalk/85 mt-3 leading-relaxed">
						{#each linkParts(paragraph) as part, index (index)}{#if part.href}<a
									class="text-chalk underline hover:text-red-bright"
									href={part.href}>{part.text}</a
								>{:else}{part.text}{/if}{/each}
					</p>
				{/each}
			</section>
		{/each}
	</div>
</article>
