<script>
	import Canvas from '$lib/components/Canvas.svelte';
	import ThreeScene from '$lib/components/ThreeScene.svelte';
	import { onMount } from 'svelte';

	let isTransitioning = false;
	let canvasComponent;
	let parentDimensions = null;
	let isReady = false;

	onMount(() => {
		// Listen for messages from parent
		window.addEventListener('message', (event) => {
			// Verify origin for security
			if (event.origin === 'https://fatscradle.com') {
				const data = event.data;

				// Check if it's a dimensions message
				if (data.type === 'dimensions') {
					parentDimensions = {
						width: data.width,
						height: data.height,
					};

					// Now we have dimensions, we can show the canvas
					isReady = true;
				}
			}
		});

		// Request dimensions from parent
		window.parent.postMessage(
			{ type: 'requestDimensions' },
			'https://fatscradle.com'
		);

		// Fallback - if we don't get parent dimensions within 1 second, show anyway
		setTimeout(() => {
			if (!isReady) {
				isReady = true;
			}
		}, 2000);
	});

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
	{#if isReady}
		<ThreeScene
			on:transitionstart={handleTransitionStart}
			on:wipe={handleWipe}
		/>
		<Canvas bind:this={canvasComponent} {parentDimensions} />
	{/if}
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
