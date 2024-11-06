<script>
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';

	let animationFrameId = null;
	let pendingRender = false;
	let lastRenderTime = 0;
	const FRAME_RATE = 60; // Target FPS
	const FRAME_INTERVAL = 1000 / FRAME_RATE;

	// Canvas setup
	let canvas;
	let ctx;
	let isDrawing = false;
	let particles = [];
	let lastX = 0;
	let lastY = 0;

	// Configuration for the drawing effect
	const CONFIG = {
		particleSize: 0.3, // Reduced from 2
		particleDensity: 8, // Increased for more particles
		lineWidth: 6, // Reduced from 12
		particleColor: '#666666', // Lighter gray
		backgroundColor: '#e8e8e8',
		gridColor: '#d4d4d4',
		hexagonSize: 6,
		whiteParticleProbability: 0.2, // 20% chance of white particles
	};

	// Initialize the canvas and set up event listeners
	onMount(() => {
		ctx = canvas.getContext('2d', { willReadFrequently: true });

		// Set canvas to full screen
		const resize = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
			drawHexagonGrid();
		};

		window.addEventListener('resize', resize);
		resize();

		// Clean up
		return () => {
			window.removeEventListener('resize', resize);
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId);
			}
		};
	});

	// Draw the background hexagon grid
	let gridCache;

	function drawHexagonGrid() {
		if (!gridCache) {
			gridCache = document.createElement('canvas');
			gridCache.width = canvas.width;
			gridCache.height = canvas.height;
			const gridCtx = gridCache.getContext('2d');

			const size = CONFIG.hexagonSize;
			const h = size * Math.sqrt(3);

			gridCtx.strokeStyle = CONFIG.gridColor;
			gridCtx.lineWidth = 0.2;

			for (let y = 0; y < canvas.height + h; y += h) {
				for (let x = 0; x < canvas.width + size * 2; x += size * 3) {
					drawHexagon(gridCtx, x, y, size);
					drawHexagon(gridCtx, x + size * 1.5, y + h / 2, size);
				}
			}
		}

		ctx.drawImage(gridCache, 0, 0);
	}

	// Update drawHexagon to accept context parameter
	function drawHexagon(context, x, y, size) {
		context.beginPath();
		for (let i = 0; i < 6; i++) {
			const angle = (i * Math.PI) / 3;
			const xPos = x + size * Math.cos(angle);
			const yPos = y + size * Math.sin(angle);
			if (i === 0) context.moveTo(xPos, yPos);
			else context.lineTo(xPos, yPos);
		}
		context.closePath();
		context.stroke();
	}

	// Update resize handler to clear cache
	const resize = () => {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		gridCache = null; // Clear cache on resize
		drawHexagonGrid();
	};

	// Generate magnetic particles along the line
	const MAX_PARTICLES = 800000; // Adjust based on needs
	function generateParticles(x1, y1, x2, y2) {
		const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
		const count = Math.min(
			Math.floor(distance * CONFIG.particleDensity),
			MAX_PARTICLES - particles.length
		);

		// If we're at max particles, remove oldest ones
		if (particles.length + count > MAX_PARTICLES) {
			particles = particles.slice(-(MAX_PARTICLES - count));
		}

		for (let i = 0; i < count; i++) {
			const ratio = i / count;
			const x = x1 + (x2 - x1) * ratio;
			const y = y1 + (y2 - y1) * ratio;

			// Calculate particle angle (perpendicular to drawing direction)
			const angle = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;

			// Random offset perpendicular to drawing direction
			const offset = (Math.random() - 0.5) * CONFIG.lineWidth;
			const perpX = Math.cos(angle) * offset;
			const perpY = Math.sin(angle) * offset;

			// Randomize particle length (0.2-0.5 times hexagon size)
			const length = CONFIG.hexagonSize * (0.2 + Math.random() * 0.3);
			// Very thin width (0.05 times hexagon size)
			const width = CONFIG.hexagonSize * 0.05;

			particles.push({
				x: x + perpX,
				y: y + perpY,
				angle: angle + ((Math.random() - 0.5) * Math.PI) / 6, // Slight random rotation
				length: length,
				width: width,
				isWhite: Math.random() < CONFIG.whiteParticleProbability,
			});
		}
	}

	// Get pointer position relative to canvas
	function getPointerPos(e) {
		const rect = canvas.getBoundingClientRect();
		return {
			x: e.clientX - rect.left,
			y: e.clientY - rect.top,
		};
	}

	//throttlerender
	function scheduleRender() {
		if (!pendingRender) {
			pendingRender = true;
			animationFrameId = requestAnimationFrame(throttledRender);
		}
	}

	function throttledRender(timestamp) {
		pendingRender = false;

		// Skip frame if too soon
		if (timestamp - lastRenderTime < FRAME_INTERVAL) {
			if (isDrawing) {
				scheduleRender();
			}
			return;
		}

		renderParticles();
		lastRenderTime = timestamp;

		if (isDrawing) {
			// Keep rendering if still drawing
			scheduleRender();
		}
	}

	// Handle mouse/touch events
	function handlePointerMove(e) {
		if (!isDrawing) return;

		const pos = getPointerPos(e);

		if (pos.x !== lastX || pos.y !== lastY) {
			generateParticles(lastX, lastY, pos.x, pos.y);
			scheduleRender(); // Replace direct renderParticles call
			lastX = pos.x;
			lastY = pos.y;
		}
	}

	function handlePointerDown(e) {
		isDrawing = true;
		const pos = getPointerPos(e);
		lastX = pos.x;
		lastY = pos.y;
		generateParticles(pos.x, pos.y, pos.x, pos.y);
		scheduleRender(); // Replace direct renderParticles call
	}

	function handlePointerUp() {
		isDrawing = false;
	}

	// Render all particles to the canvas
	function renderParticles() {
		ctx.fillStyle = CONFIG.backgroundColor;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Draw cached grid
		drawHexagonGrid();

		// Batch particles by color
		const darkParticles = [];
		const lightParticles = [];

		particles.forEach((particle) => {
			(particle.isWhite ? lightParticles : darkParticles).push(particle);
		});

		// Draw particles by batch
		[darkParticles, lightParticles].forEach((batch) => {
			if (batch.length === 0) return;

			ctx.fillStyle =
				batch === lightParticles ? '#ffffff' : CONFIG.particleColor;

			batch.forEach((particle) => {
				ctx.save();
				ctx.translate(particle.x, particle.y);
				ctx.rotate(particle.angle);
				ctx.fillRect(
					-particle.length / 2,
					-particle.width / 2,
					particle.length,
					particle.width
				);
				ctx.restore();
			});
		});
	}

	// Clear the drawing
	function clearCanvas() {
		ctx.fillStyle = CONFIG.backgroundColor;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		drawHexagonGrid();
		particles = [];
		lastX = 0;
		lastY = 0;
	}
</script>

<div class="canvas-container">
	<canvas
		bind:this={canvas}
		on:pointerdown={handlePointerDown}
		on:pointermove={handlePointerMove}
		on:pointerup={handlePointerUp}
		on:pointerleave={handlePointerUp}
	></canvas>

	<button class="clear-button" on:click={clearCanvas}> Clear </button>
</div>

<style lang="scss">
	:global(body) {
		margin: 0;
		overflow: hidden;
	}

	.canvas-container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	canvas {
		touch-action: none;
		background-color: #e8e8e8;
		cursor: crosshair;
		display: block;
	}

	.clear-button {
		position: fixed;
		bottom: 20px;
		right: 20px;
		padding: 10px 20px;
		background: #ff4444;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 16px;
		transition: transform 0.2s;
		z-index: 10;

		&:hover {
			transform: scale(1.05);
		}

		&:active {
			transform: scale(0.95);
		}
	}
</style>
