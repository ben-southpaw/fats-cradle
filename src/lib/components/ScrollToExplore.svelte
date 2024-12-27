<script>
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import scrollToExplore from '$lib/images/scrolltoexplore.svg?url';

	export let onAnimationComplete = () => {};
	let container;
	export let hasAnimated = false;

	export function startAnimation() {
		if (hasAnimated) return;
		hasAnimated = true;

		return new Promise((resolve) => {
			const timeline = gsap.timeline({
				onComplete: () => {
					onAnimationComplete();
					resolve();
				},
			});

			// Target the image for animation
			timeline.to(container, {
				opacity: 0,
				y: 30,
				duration: 0.5,
				ease: 'power2.inOut',
			});
		});
	}
</script>

<img bind:this={container} src={scrollToExplore} alt="scroll to explore" />

<style>
	img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
</style>
