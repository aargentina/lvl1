<script lang="ts">
    import { onMount } from 'svelte';
	import { createPostsIndex, searchPostsIndex } from '$lib/bgsearch';
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

	let search: 'loading' | 'ready' = 'loading';
	let searchTerm = '';
	let results: SearchResult[] = [];
	let selectedCategories: string[] = [];
	let allPosts: Boardgame[] = [];

	// Available categories for filtering
	const availableCategories = [
		'New',
		'Adult',
		'Cooperative',
		'Dexterity',
		'Family',
		'Light Strategy',
		'Bilingual', // Special filter for Bilingual column
		'Party',
		'Solo',
		'Strategy',
		'Trivia',
		'Two Player'
	];

	onMount(async () => {
		try {
			const f = await (
				await fetch(
					'https://docs.google.com/spreadsheets/d/e/2PACX-1vQFx_Iv2nSAN_JE0rcJ4CasXx5bGqHiaffaZTwI-hQyN8WouUed9eV6wTWvOlz5zyRhCy5LK-jIB_3p/pub?output=csv'
				)
			).text();
			const wb = read(f, { type: 'string' });
			const posts = utils.sheet_to_json<Boardgame>(wb.Sheets[wb.SheetNames[0]]);
			allPosts = posts;
			createPostsIndex(posts);
			search = 'ready';
			
			// Debug: Log unique categories to see what's actually in the data
			const uniqueCategories = [...new Set(posts.map(post => post.Category))];
			console.log('Available categories in data:', uniqueCategories);
			
			// Debug: Show a few sample posts to see the exact format
			console.log('Sample posts:', posts.slice(0, 3).map(post => ({
				Games: post.Games,
				Category: post.Category,
				Bilingual: post.Bilingual
			})));
		} catch (error) {
			console.error('Error loading data:', error);
			search = 'ready';
		}
	});

	// Import copy of CSV if the google link is down again
	// onMount(async () => {
    //     try {
    //         // Import the local CSV file
    //         const csvModule = await import('$lib/assets/tables/bgdata.csv?raw');
    //         const csvData = csvModule.default;
            
    //         // Parse the CSV data using xlsx utilities
    //         const wb = read(csvData, { type: 'string' });
    //         const posts = utils.sheet_to_json<Boardgame>(wb.Sheets[wb.SheetNames[0]]);
    //         allPosts = posts;
    //         createPostsIndex(posts);
    //         search = 'ready';
            
    //         // Debug: Log unique categories to see what's actually in the data
    //         const uniqueCategories = [...new Set(posts.map(post => post.Category))];
    //         console.log('Available categories in data:', uniqueCategories);
            
    //         // Debug: Show a few sample posts to see the exact format
    //         console.log('Sample posts:', posts.slice(0, 3).map(post => ({
    //             Games: post.Games,
    //             Category: post.Category,
    //             Bilingual: post.Bilingual
    //         })));
    //     } catch (error) {
    //         console.error('Error loading data:', error);
    //         search = 'ready';
    //     }
    // });

	// Reactive statement to update results when search term or categories change
	$: if (search === 'ready') {
		if (searchTerm.trim() === '' && selectedCategories.length === 0) {
			results = allPosts;
		} else {
			results = searchPostsIndex(searchTerm, selectedCategories);
		}
	}

	function clearAll() {
		searchTerm = '';
		selectedCategories = [];
	}
</script>

{#if search === 'ready'}
	<div class="w-full pb-8">
		<!-- Category Filter Section -->
		<div class="mb-6">
			<!-- <h3 class="text-lg font-semibold mb-3 text-primary-100">Filter by Category</h3> -->
			<div class="grid grid-cols-2 gap-4">
				<ListBox multiple hover="" rounded="rounded-xl" class="border border-white/10 bg-ink" active="bg-red-bright text-chalk">
					<ListBoxItem bind:group={selectedCategories} name="category" value="New">New</ListBoxItem>
					<ListBoxItem bind:group={selectedCategories} name="category" value="Adult">Adult</ListBoxItem>
					<ListBoxItem bind:group={selectedCategories} name="category" value="Cooperative">Cooperative</ListBoxItem>
					<ListBoxItem bind:group={selectedCategories} name="category" value="Dexterity">Dexterity</ListBoxItem>
					<ListBoxItem bind:group={selectedCategories} name="category" value="Family">Family</ListBoxItem>
					<ListBoxItem bind:group={selectedCategories} name="category" value="Light Strategy">Light Strategy</ListBoxItem>
				</ListBox>
				<ListBox multiple hover="" rounded="rounded-xl" class="border border-white/10 bg-ink" active="bg-red-bright text-chalk">
					<ListBoxItem bind:group={selectedCategories} name="category" value="Bilingual">Bilingual</ListBoxItem>
					<ListBoxItem bind:group={selectedCategories} name="category" value="Party">Party</ListBoxItem>
					<ListBoxItem bind:group={selectedCategories} name="category" value="Solo">Solo</ListBoxItem>
					<ListBoxItem bind:group={selectedCategories} name="category" value="Strategy">Strategy</ListBoxItem>
					<ListBoxItem bind:group={selectedCategories} name="category" value="Trivia">Trivia</ListBoxItem>
					<ListBoxItem bind:group={selectedCategories} name="category" value="Two Player">Two Player</ListBoxItem>
				</ListBox>
			</div>
		</div>

		<!-- Search Results Section -->
		<div
			class="h-96 w-full overflow-y-auto rounded-t-xl border border-white/10 bg-ink/60 backdrop-blur-md"
			aria-live="polite"
		>
			{#if results && results.length > 0}
				<ul class="grid w-full list-none grid-flow-row lg:grid-cols-3">
					{#each results as result}
						<li class="p-2">
							<a
								href={result.URL}
								target="_blank"
								rel="noopener noreferrer"
								class="block text-lg text-chalk lg:text-2xl hover:bg-chalk/10 transition-colors"
							>
								<p class="text-pretty">{@html result.Games}</p>
								<div class="flex flex-row flex-wrap gap-2">
									<p class="text-sm text-red-bright">{@html result.Category}</p>
									<p class="text-sm text-chalk/60">{@html result.Bilingual}</p>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			{:else if results && results.length === 0}
				<div class="p-8 text-center text-chalk/60">
					<p>No results found. Try adjusting your search or filters.</p>
				</div>
			{/if}
		</div>

		<!-- Search Input Section -->
		<div class="relative flex w-full gap-2 pt-6 font-body text-2xl">
			<label for="Search" class="sr-only">Search board games</label>
			<input
				bind:value={searchTerm}
				placeholder="Search games..."
				autocomplete="off"
				spellcheck="false"
				type="search"
				id="Search"
				class="w-full rounded-xl border border-white/10 bg-chalk p-6 text-ink placeholder:text-ink/40 outline-none focus:outline-4 focus:outline-red-bright focus:-outline-offset-1 drop-shadow-2xl transition-colors"
			/>
			<!-- With search changes this clear all might not be needed -->
			
			<!-- <button
				class="rounded-xl bg-gradient-to-br from-tertiary-600 to-secondary-600 px-5 py-3 text-2xl text-primary-50 hover:shadow-lg hover:shadow-tertiary-600 transition-all"
				on:click={clearAll}
			>
				Clear All
			</button> -->
		</div>

		<!-- Results Count -->


		<!-- {#if results}
			<div class="text-sm text-primary-300 mt-2">
				Showing {results.length} result{results.length !== 1 ? 's' : ''}
			</div>
		{/if} -->
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