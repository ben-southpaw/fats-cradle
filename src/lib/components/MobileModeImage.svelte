<script>
	import { onMount, onDestroy } from 'svelte';
	import { isDesktop } from '$lib/stores/breakpoint';
	import modelJpg from '$lib/images/model.jpg?url';

	let windowWidth = 0;

	// Handle window resize
	function handleResize() {
		windowWidth = window.innerWidth;
		// Force update by reading the store value
		// This ensures the component reacts to window size changes
		const _ = $isDesktop;
	}

	onMount(() => {
		windowWidth = window.innerWidth;
		window.addEventListener('resize', handleResize);
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});

	// Log changes for debugging
	$: console.log('MobileModeImage - isDesktop:', $isDesktop, 'windowWidth:', windowWidth);
</script>

<div class="mobile-mode" class:visible={!$isDesktop}>
	<img src={modelJpg} alt="Model" />
</div>

<style>
	.mobile-mode {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		opacity: 0;
		visibility: hidden;
		transition:
			opacity 0.3s ease,
			visibility 0.3s ease;
		pointer-events: none;
	}

	.mobile-mode.visible {
		opacity: 1;
		visibility: visible;
		pointer-events: auto;
		/* Add a transition for better debugging */
		transition:
			opacity 0.3s ease,
			visibility 0.3s ease;
	}

	.mobile-mode img {
		object-fit: contain;
		width: 100%;
		height: 100%;
	}
</style>
