<script lang="ts">
	import { SliceZone } from '@prismicio/svelte';

	import { components } from '$lib/slices';
	import DndApplications from '$lib/components/DndApplications.svelte';

	let { data } = $props();
</script>

{#if data.page.uid === 'dnd'}
	<DndApplications />
{/if}

<SliceZone slices={data.page.data.slices} {components} />
