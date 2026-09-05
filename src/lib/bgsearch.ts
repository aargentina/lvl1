import FlexSearch from 'flexsearch';

interface Post {
	Games: string;
	Category: string;
	URL: string;
	Bilingual: string;
	Hidden: string;
}

let postsIndex: FlexSearch.Index;
let posts: Post[];

export function createPostsIndex(data: Post[]) {
	postsIndex = new FlexSearch.Index({ tokenize: 'forward' });

	data.forEach((post, i) => {
		// For board games, only index Games, Bilingual, and Hidden - NOT Category or URL
		// This prevents searching for "light" from matching "Light Strategy" category
		// and prevents URL text from being searchable
		const item = `${post.Games} ${post.Bilingual} ${post.Hidden}`;
		postsIndex.add(i, item);
	});

	posts = data;
}

export function searchPostsIndex(searchTerm: string, categories: string[] = []) {
	let results: (number | string)[];

	// If we have a search term, search the posts index
	if (searchTerm.trim()) {
		results = postsIndex.search(searchTerm);
	} else {
		// If no search term, get all posts (all indices)
		results = Array.from({ length: posts.length }, (_, i) => i);
	}

	// If we have categories selected, filter the results by category using AND logic
	if (categories.length > 0) {
		// Separate bilingual filtering from category filtering
		const regularCategories = categories.filter(cat => cat !== 'Bilingual');
		const hasBilingualFilter = categories.includes('Bilingual');

		// Filter results to only include items that match ALL selected categories
		results = results.filter((index) => {
			const indexNum = Number(index);
			const post = posts[indexNum];

			// Check regular categories with exact matching
			const matchesRegularCategories = regularCategories.every(category => {
				// Handle cases where Category might be undefined or null
				if (!post.Category) {
					return false;
				}

				// Split the category field by " / " (forward slash surrounded by spaces) and trim whitespace
				const postCategories = post.Category.split(' / ').map(cat => cat.trim());
				const hasMatch = postCategories.some(postCat => postCat === category);

				return hasMatch;
			});

			// Check bilingual filter if selected
			if (hasBilingualFilter) {
				const bilingualMatch = post.Bilingual.includes('en/fr');
				return matchesRegularCategories && bilingualMatch;
			}

			return matchesRegularCategories;
		});
	}

	// Map results to the original posts
	const mappedResults = results.map((index) => posts[Number(index)]);

	// Filter out items that have any value in the Hidden column
	const filteredResults = mappedResults.filter(post => !post.Hidden);

	// Sort the filtered results alphabetically by Games
	const sortedResults = filteredResults.sort((a, b) => a.Games.localeCompare(b.Games));

	// Format the sorted results
	return sortedResults.map(({ Games, Bilingual, Category, URL, Hidden }) => {
		return { Games, Bilingual, Category, URL, Hidden };
	});
}
