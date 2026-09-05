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
		const item = `${post.Games} ${post.Category} ${post.URL} ${post.Bilingual} ${post.Hidden}`;
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

	// If we have categories selected, filter the results by category
	// For video games, use OR logic (match ANY selected console)
	if (categories.length > 0) {
		// Filter results to include items that match ANY selected category
		results = results.filter((index) => {
			const indexNum = Number(index);
			const post = posts[indexNum];

			// Handle cases where Category might be undefined or null
			if (!post.Category) {
				return false;
			}

			// Split the category field by "/" (with or without spaces) and trim whitespace
			// This handles formats like "Switch/WiiU" or "Switch / WiiU"
			const postCategories = post.Category.split('/').map(cat => cat.trim());

			// Check if ANY of the selected categories match ANY of the post's categories
			const hasMatch = categories.some(selectedCat =>
				postCategories.some(postCat => postCat === selectedCat)
			);

			return hasMatch;
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
