<script lang="ts">
	import { onMount } from 'svelte';
	import { createPostsIndex, searchPostsIndex } from '$lib/search';
	import { read, utils } from 'xlsx';
	import { ListBox, ListBoxItem } from '@skeletonlabs/skeleton';

	interface Boardgame {
		Games: string;
		Bilingual: string;
		Category: string;
		URL: string;
		Hidden: string;
	}

	type SearchResult = {
		Games: string;
		Bilingual: string;
		Category: string;
		URL: string;
		Hidden: string;
	};

	let search: 'loading' | 'ready' = $state('loading');
	let searchTerm = $state('');
	let results = $state<SearchResult[]>([]);
	let valueMultiple = $state<string[]>([]);
	let allPosts: Boardgame[] = [];

	onMount(async () => {
		const f = await (
			await fetch(
				'https://docs.google.com/spreadsheets/d/e/2PACX-1vThSfipWWiyIoyAETkBte74vb5JV2goo_HkAG-0grRhOlqfVy-i_vc-A0CylY7-6kaWzVmnmks03ZuC/pub?output=csv'
			)
		).text();
		const wb = read(f, { type: 'string' });
		const posts = utils.sheet_to_json<Boardgame>(wb.Sheets[wb.SheetNames[0]]);
		allPosts = posts;
		createPostsIndex(posts);
		search = 'ready';
	});



	$effect(() => {
		if (search === 'ready') {
			if (searchTerm.trim() === '' && valueMultiple.length === 0) {
				results = allPosts;
			} else {
				results = searchPostsIndex(searchTerm, valueMultiple);
			}
		}
	});
</script>

{#if search === 'ready'}
	<div class="grid grid-cols-2 gap-4 py-4">
		<ListBox multiple hover="" rounded="rounded-xl" class="border border-white/10 bg-ink" active="bg-red-bright text-chalk">
			<ListBoxItem bind:group={valueMultiple} name="medium" value="Gamecube">Gamecube</ListBoxItem>
			<ListBoxItem bind:group={valueMultiple} name="medium" value="N64">N64</ListBoxItem>
			<ListBoxItem bind:group={valueMultiple} name="medium" value="NES">NES</ListBoxItem>
			<ListBoxItem bind:group={valueMultiple} name="medium" value="SNES">SNES</ListBoxItem>
			<ListBoxItem bind:group={valueMultiple} name="medium" value="PS1">PS1</ListBoxItem>
			<ListBoxItem bind:group={valueMultiple} name="medium" value="PS2">PS2</ListBoxItem>
			<ListBoxItem bind:group={valueMultiple} name="medium" value="PS3">PS3</ListBoxItem>
		</ListBox>
		<ListBox multiple hover="" rounded="rounded-xl" class="border border-white/10 bg-ink" active="bg-red-bright text-chalk">
			<ListBoxItem bind:group={valueMultiple} name="medium" value="PS4">PS4</ListBoxItem>
			<ListBoxItem bind:group={valueMultiple} name="medium" value="PS5">PS5</ListBoxItem>
			<ListBoxItem bind:group={valueMultiple} name="medium" value="SEGA Genesis">SEGA</ListBoxItem>
			<ListBoxItem bind:group={valueMultiple} name="medium" value="Switch">Switch</ListBoxItem>
			<ListBoxItem bind:group={valueMultiple} name="medium" value="Switch2">Switch 2</ListBoxItem>
			<ListBoxItem bind:group={valueMultiple} name="medium" value="Wii">Wii</ListBoxItem>
			<ListBoxItem bind:group={valueMultiple} name="medium" value="WiiU">WiiU</ListBoxItem>
			<ListBoxItem bind:group={valueMultiple} name="medium" value="Xbox360">Xbox360</ListBoxItem>
		</ListBox>
	</div>
	<div class="h-96 overflow-y-auto rounded-t-xl border border-white/10 bg-ink/60 backdrop-blur-md">
		{#if results}
			<ul class="grid w-full list-none grid-flow-row lg:grid-cols-3">
				{#each results as result}
					<a
						href={result.URL}
						target="_blank"
						rel="noopener noreferrer"
						class="block text-lg text-chalk lg:text-2xl hover:bg-chalk/10 transition-colors"
					>
						<li class="p-2">
							<p class="text-pretty">{@html result.Games}</p>

							<div class="flex flex-row flex-wrap gap-2">
								<p class="text-sm text-red-bright">{@html result.Category}</p>
								<p class="text-sm text-chalk/60">{@html result.Bilingual}</p>
							</div>
						</li>
					</a>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="relative flex w-full gap-2 font-body text-2xl">
		<input
			value={searchTerm}
			placeholder="Search..."
			autocomplete="off"
			spellcheck="false"
			type="search"
			id="Search"
			class="w-full rounded-xl border border-white/10 bg-chalk p-6 text-ink placeholder:text-ink/40 outline-none drop-shadow-2xl transition-colors focus:outline-4 focus:-outline-offset-1 focus:outline-red-bright"
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					searchTerm = e.currentTarget.value;
				}
			}}
		/>
		<button
			class="rounded-xl bg-gradient-to-br from-red to-red-bright px-5 py-3 font-heading text-base uppercase tracking-wide text-chalk hover:shadow-lg hover:shadow-red/40"
			onclick={() => {
				searchTerm = '';
				valueMultiple = [];
			}}>Clear All</button
		>
	</div>
{/if}

{#if search === 'loading'}
	<section class="card w-full bg-ink-noise pt-4">
		<div class="placeholder-circle ml-4 w-16 bg-white/10"></div>
		<div class="space-y-4 p-4">
			<div class="placeholder bg-white/10"></div>
			<div class="grid grid-cols-3 gap-8">
				<div class="placeholder bg-white/10"></div>
				<div class="placeholder bg-white/10"></div>
				<div class="placeholder bg-white/10"></div>
			</div>
			<div class="placeholder bg-white/10"></div>
		</div>
	</section>
{/if}
