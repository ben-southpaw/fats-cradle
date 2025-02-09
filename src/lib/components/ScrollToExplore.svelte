<script>
	import { onMount } from 'svelte';
	import scrollToExploreAnimation from '$lib/images/lottie/animations/0619d505-1c63-42a8-972d-70aeeb5d2763.json';

	let container;
	let LottiePlayer;
	let lottieInstance;
	let mounted = false;
	let isPlaying = false;

	function handleWheel() {
		if (!lottieInstance || isPlaying) return;

		isPlaying = true;
		lottieInstance.play();

		// // Stop after one play
		// lottieInstance.addEventListener('complete', () => {
		// 	isPlaying = false;
		// 	lottieInstance.stop();
		// });
	}

	onMount(async () => {
		const module = await import('@lottiefiles/svelte-lottie-player');
		LottiePlayer = module.LottiePlayer;
		mounted = true;

		// Add wheel event listener to window
		window.addEventListener('wheel', handleWheel, { passive: true });

		return () => {
			window.removeEventListener('wheel', handleWheel);
		};
	});
</script>

<div class="container" bind:this={container}>
	{#if mounted && LottiePlayer}
		<svelte:component
			this={LottiePlayer}
			bind:this={lottieInstance}
			src={scrollToExploreAnimation}
			autoplay={false}
			controls={false}
			renderer="svg"
			background="transparent"
			controlsLayout={[]}
			class="lottie-player"
		/>
	{/if}
</div>

<style>
	.container {
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	:global(.lottie-player) {
		width: min(600px, 80vw) !important;
		height: min(300px, 40vh) !important;
	}
</style>
