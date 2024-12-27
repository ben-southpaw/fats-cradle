<script>
	import Canvas from '$lib/components/Canvas.svelte';
	import ThreeScene from '$lib/components/ThreeScene.svelte';

	let threeScene;
	let showScrollToExplore = true;

	function handleTransitionStart() {
		showScrollToExplore = false;
	}
</script>

<section>
	<Canvas
		onScreenCanvasReady={(canvas) => {
			if (threeScene) {
				threeScene.handleCanvasReady(canvas);
			}
		}}
		{showScrollToExplore}
	/>
	<ThreeScene 
		bind:this={threeScene} 
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
