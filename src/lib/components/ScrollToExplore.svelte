<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { createEventDispatcher } from 'svelte';
	import scrollToExploreAnimation from '$lib/images/lottie/animations/0619d505-1c63-42a8-972d-70aeeb5d2763.json';

	const dispatch = createEventDispatcher();
	let container;
	let LottiePlayer;
	let mounted = false;
	let visible = false;
	let lottieInstance;

	onMount(async () => {
		const module = await import('@lottiefiles/svelte-lottie-player');
		LottiePlayer = module.LottiePlayer;
		mounted = true;

		// Delay showing the component
		setTimeout(() => {
			visible = true;
		}, 800);

		// Listen for scroll events
		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	});

	function handleScroll() {
		if (lottieInstance) {
			lottieInstance.play();
		}
	}

	export function play() {
		if (lottieInstance) {
			lottieInstance.play();
			// Listen for complete event
			lottieInstance.addEventListener('complete', () => {
				dispatch('complete');
			});
		}
	}
</script>

<div class="container" bind:this={container}>
	{#if mounted && LottiePlayer && visible}
		<div transition:fade={{ duration: 800 }}>
			<svelte:component
				this={LottiePlayer}
				src={scrollToExploreAnimation}
				autoplay={false}
				loop={false}
				controls={false}
				renderer="svg"
				background="transparent"
				controlsLayout={[]}
				class="lottie-player"
				on:load={(e) => (lottieInstance = e.detail.instance)}
			/>
		</div>
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
