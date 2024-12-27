<script>
	import Canvas from '$lib/components/Canvas.svelte';
	import ThreeScene from '$lib/components/ThreeScene.svelte';

	let threeScene;
</script>

<section>
	<Canvas
		onScreenCanvasReady={(canvas) => {
			if (threeScene) {
				threeScene.handleCanvasReady(canvas);
			}
		}}
	/>
	<ThreeScene bind:this={threeScene} />
</section>

<style>
	section {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100vh;
	}
</style>
