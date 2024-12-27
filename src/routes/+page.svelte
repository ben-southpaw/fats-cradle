<script>
	import Canvas from '../lib/components/Canvas.svelte';
	import ThreeScene from '../lib/components/ThreeScene.svelte';

	let threeSceneComponent;

	function handleScreenCanvasReady(canvas) {
		if (threeSceneComponent) {
			threeSceneComponent.setScreenCanvas(canvas);
		}
	}
</script>

<section>
	<Canvas onScreenCanvasReady={handleScreenCanvasReady} />
	<ThreeScene bind:this={threeSceneComponent} />
</section>

<style>
	section {
		position: relative;
		width: 100%;
		height: 100vh;
		overflow: hidden;
	}
</style>
