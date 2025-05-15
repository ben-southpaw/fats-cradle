<script>
	import { onMount } from 'svelte';
	import scrollToExploreAnimation from '$lib/images/lottie/animations/animation.json';

	let container;
	let LottiePlayer;
	let lottieInstance;
	let mounted = false;
	let isPlaying = false;

	function handleComplete() {
		isPlaying = false;
		lottieInstance?.stop();
	}

	function handleWheel() {
		if (!lottieInstance || isPlaying) return;
		isPlaying = true;
		lottieInstance.play();
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
			controlsLayout={[]}
			class="lottie-player"
			on:complete={handleComplete}
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
		opacity: 1;
	}

	:global(.lottie-player) {
		width: min(700px, 50vw) !important;
		height: min(350px, 32vh) !important;
	}
</style>
