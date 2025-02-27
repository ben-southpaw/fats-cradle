<script>
	import Canvas from '$lib/components/Canvas.svelte';
	import ThreeScene from '$lib/components/ThreeScene.svelte';

	let isTransitioning = false;
	let canvasComponent;

	function handleTransitionStart() {
		isTransitioning = true;
	}

	function handleWipe(event) {
		const progress = event.detail.progress;
		if (canvasComponent) {
			canvasComponent.clearWithProgress(progress);
		}
	}
</script>

<section>
	<Canvas bind:this={canvasComponent} />
	<ThreeScene on:transitionstart={handleTransitionStart} on:wipe={handleWipe} />
</section>

<style>
	section {
		position: relative;
		width: 100vw;
		max-width: 100vw;
		height: 100vh;
		overflow: hidden;
	}
</style>
