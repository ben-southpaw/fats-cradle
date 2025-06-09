<script>
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { fade } from 'svelte/transition';
	import { appState, deviceInfo } from '$lib/stores/appState';
	import scrollToExploreAnimation from '$lib/images/lottie/animations/animation.json';

	let container;
	let LottiePlayer;
	let lottieInstance;
	let mounted = false;
	let isPlaying = false;
	let isVisible = true;

	function handleComplete() {
		isPlaying = false;
		lottieInstance?.stop();
	}

	function handleWheel() {
		if (!lottieInstance || isPlaying) return;
		
		// Play the animation
		isPlaying = true;
		lottieInstance.play();
		
		// Also notify appState that a transition has been triggered
		try {
			appState.startTransition();
		} catch (error) {
			console.warn('Error updating appState from ScrollToExplore', error);
		}
	}

	// Subscribe to appState changes to hide scroll indicator once transition starts
	let unsubscribeAppState;

	onMount(async () => {
		const module = await import('@lottiefiles/svelte-lottie-player');
		LottiePlayer = module.LottiePlayer;
		mounted = true;

		// Add wheel event listener to window
		window.addEventListener('wheel', handleWheel, { passive: true });
		
		// Subscribe to appState to hide when transitioning
		unsubscribeAppState = appState.subscribe(($appState) => {
			// Hide the scroll indicator once we're transitioning or interactive
			if ($appState.currentState !== 'initial') {
				isVisible = false;
			}
		});
		
		// Check if we should auto-trigger on mobile/tablet
		const isMobileOrTablet = get(deviceInfo)?.isMobileOrTablet;
		if (isMobileOrTablet) {
			// On mobile, we don't need the scroll indicator since we auto-transition
			isVisible = false;
		}
	});
	
	// Clean up subscriptions
	onDestroy(() => {
		window.removeEventListener('wheel', handleWheel);
		if (unsubscribeAppState) unsubscribeAppState();
	});
</script>

{#if isVisible}
<div 
	class="container" 
	bind:this={container}
	transition:fade={{ duration: 300 }}
>
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
{/if}

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
