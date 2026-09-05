<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { PrismicRichText } from '@prismicio/svelte';
	import Heading1 from './Heading1.svelte';
	import Heading2 from './Heading2.svelte';
	import Heading3 from '$lib/components/PrismicRichText/Heading3.svelte';
	import Paragraph from '$lib/components/PrismicRichText/Paragraph.svelte';
	import OList from '$lib/components/PrismicRichText/OList.svelte';
	import OListItem from '$lib/components/PrismicRichText/OListItem.svelte';
	import List from '$lib/components/PrismicRichText/List.svelte';
	import ListItem from '$lib/components/PrismicRichText/ListItem.svelte';
	import Preformatted from '$lib/components/PrismicRichText/Preformatted.svelte';
	import Strong from '$lib/components/PrismicRichText/Strong.svelte';
	import Hyperlink from '$lib/components/PrismicRichText/Hyperlink.svelte';

	interface Props {
		field: ComponentProps<typeof PrismicRichText>['field'];
		components?: ComponentProps<typeof PrismicRichText>['components'];
	}

	let { field, components = {} }: Props = $props();
</script>

<PrismicRichText
	{field}
	components={{
		heading1: Heading1,
		heading2: Heading2,
		heading3: Heading3,
		paragraph: Paragraph,
		oList: OList,
		oListItem: OListItem,
		list: List,
		listItem: ListItem,
		preformatted: Preformatted,
		strong: Strong,
		hyperlink: Hyperlink,
		...components
	}}
/>
