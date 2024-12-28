<script>
	import Canvas from '$lib/components/Canvas.svelte';

	let showScrollToExplore = true;

	function handleTransitionStart() {
		showScrollToExplore = false;
	}
</script>

<section>
	<Canvas
		{showScrollToExplore}
		on:transitionstart={handleTransitionStart}
	/>
</section>

<style>
	section {
		position: relative;
		width: 100%;
		height: 100vh;
		overflow: hidden;
	}
</style>
