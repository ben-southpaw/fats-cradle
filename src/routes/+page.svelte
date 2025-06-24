<script>
	import Canvas from '$lib/components/Canvas.svelte';
	import ThreeScene from '$lib/components/ThreeScene.svelte';
	import ScrollToExplore from '$lib/components/ScrollToExplore.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { appState, APP_STATES } from '$lib/stores/appState';
import { isDesktop } from '$lib/stores/breakpoint';
import MobileModeImage from '$lib/components/MobileModeImage.svelte';

	// Local component state
	let isTransitioning = false;
	let canvasComponent;
	let parentDimensions = null;
	let isReady = false;
	
	// Subscribe to appState for coordinated transitions
	let unsubscribeAppState;


    //add browser lister subscribe to check for ratio to set mob/desktop landscape/portrait 

	onMount(() => {
		// Subscribe to the app state to coordinate transition states
		unsubscribeAppState = appState.subscribe(($appState) => {
			// Update local transition state based on app state
			isTransitioning = $appState.currentState === APP_STATES.TRANSITIONING;
		});

		// Trigger auto-transition for mobile/tablet devices
		appState.triggerAutoTransitionIfNeeded();
		
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
	
	// Clean up subscriptions when component is destroyed
	onDestroy(() => {
		if (unsubscribeAppState) unsubscribeAppState();
	});

	// Handle transition start event from ThreeScene
	function handleTransitionStart() {
		// Update local state
		isTransitioning = true;
		
		// Update app state - safely with error handling
		try {
			appState.startTransition();
		} catch (error) {
			console.warn('Error updating appState in transition start', error);
		}
	}

	// Handle wipe event and update transition progress
	function handleWipe(event) {
		const progress = event.detail.progress;
		
		// Update canvas wipe effect
		if (canvasComponent) {
			canvasComponent.clearWithProgress(progress);
		}
		
		// Update app state with transition progress - safely with error handling
		try {
			appState.updateTransitionProgress(3, progress); // Phase 3: Wipe
		} catch (error) {
			console.warn('Error updating transition progress', error);
		}
	}
</script>

<section>
	{#if $isDesktop}
		{#if isReady}
			<!-- ScrollToExplore with original fadeout behavior -->
			<div class="scroll-indicator">
				<ScrollToExplore />
			</div>
			<Canvas bind:this={canvasComponent} {parentDimensions} />
			<!-- <ThreeScene on:transitionstart={handleTransitionStart} on:wipe={handleWipe} /> -->
		{/if}
	{:else}
		<MobileModeImage />
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
	
	/* Match exact styling from the original implementation */
	.scroll-indicator {
		position: absolute;
		top: 8vh;
		height: 10vh;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10;
		pointer-events: none;
		opacity: 1;
		width: 100%;
	}
</style>
