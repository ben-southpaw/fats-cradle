<script>
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import scrollToExplore from '$lib/images/scrolltoexplore.svg?url';

	export let onAnimationComplete = () => {};
	let container;
	export let hasAnimated = false;

	onMount(() => {
		// Ensure initial position
		gsap.set(container, {
			y: 0,
			opacity: 1
		});
	});

	export function startAnimation() {
		if (hasAnimated) return;
		hasAnimated = true;

		return new Promise((resolve) => {
			gsap.to(container, {
				y: -80,
				opacity: 0,
				duration: 1,
				ease: "power2.inOut",
				onComplete: () => {
					onAnimationComplete();
					resolve();
				}
			});
		});
	}
</script>

<div class="container" bind:this={container}>
	<img src={scrollToExplore} alt="scroll to explore" />
</div>

<style>
	.container {
		width: 100%;
		height: 100%;
		transform: translate(0, 0);
	}
	
	img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
</style>
