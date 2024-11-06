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
	let wiperPosition = 0; // 0 to 1 range
	let isDraggingWiper = false;
	let wiperKnobWidth = 40; // Width of the knob in pixels

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

		window.addEventListener('pointermove', handleWiperMove);
		window.addEventListener('pointerup', handleWiperUp);

		// Clean up
		return () => {
			window.removeEventListener('resize', resize);
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId);
			}

			window.removeEventListener('pointermove', handleWiperMove);
			window.removeEventListener('pointerup', handleWiperUp);
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

	// Update handleWiperDown to set initial position
	function handleWiperDown(e) {
		isDraggingWiper = true;
		lastWiperPosition = wiperPosition;
		updateWiperPosition(e);
	}

	function handleWiperMove(e) {
		if (!isDraggingWiper) return;
		updateWiperPosition(e);
	}

	// Reset lastWiperPosition when dragging ends
	function handleWiperUp() {
		isDraggingWiper = false;
		lastWiperPosition = wiperPosition;
	}

	let lastWiperPosition = 0; // Add this at the top with other state variables

	function updateWiperPosition(e) {
		const rect = canvas.getBoundingClientRect();
		const newPosition = Math.max(
			0,
			Math.min(1, (e.clientX - rect.left) / rect.width)
		);

		// Clear the area between last position and new position
		clearBetweenPositions(lastWiperPosition, newPosition);

		lastWiperPosition = newPosition;
		wiperPosition = newPosition;
	}

	function clearBetweenPositions(from, to) {
		const x1 = Math.min(from, to) * canvas.width;
		const x2 = Math.max(from, to) * canvas.width;

		// If the width is 0 or too small, skip processing
		if (x2 - x1 < 1) return;

		// Clear the rectangle between positions
		ctx.fillStyle = CONFIG.backgroundColor;
		ctx.fillRect(x1, 0, x2 - x1, canvas.height);

		// Create temporary canvas with minimum width of 1
		const tempCanvas = document.createElement('canvas');
		tempCanvas.width = Math.max(1, x2 - x1);
		tempCanvas.height = canvas.height;
		const tempCtx = tempCanvas.getContext('2d');

		// Draw hexagons in the cleared area
		const size = CONFIG.hexagonSize;
		const h = size * Math.sqrt(3);
		tempCtx.strokeStyle = CONFIG.gridColor;
		tempCtx.lineWidth = 0.2;

		for (let y = 0; y < canvas.height + h; y += h) {
			for (let x = -size * 2; x < tempCanvas.width + size * 2; x += size * 3) {
				drawHexagon(tempCtx, x, y, size);
				drawHexagon(tempCtx, x + size * 1.5, y + h / 2, size);
			}
		}

		// Copy the hexagon pattern back to main canvas
		ctx.drawImage(tempCanvas, x1, 0);

		// Remove particles in the cleared area with a small buffer
		particles = particles.filter((p) => p.x < x1 - 1 || p.x > x2 + 1);

		// Redraw remaining particles
		renderParticles();
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
	{#if isDraggingWiper}
		<div
			class="wiper-line"
			style="height: 100%"
			style:left={`${wiperPosition * 100}%`}
		></div>
	{/if}
	<!-- <button class="clear-button" on:click={clearCanvas}> Clear </button> -->
	<div class="wiper-container">
		<div class="wiper-bar"></div>
		<div
			class="wiper-knob"
			style:left={`calc(${wiperPosition * 100}% - ${wiperKnobWidth / 2}px)`}
			on:pointerdown={handleWiperDown}
		>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 60">
				<!-- Main knob body -->
				<rect x="5" y="10" width="30" height="40" rx="15" fill="#cc0000" />
				<!-- Highlight -->
				<rect
					x="12"
					y="15"
					width="16"
					height="30"
					rx="8"
					fill="#ff3333"
					opacity="0.3"
				/>
				<!-- Grip lines -->
				<line
					x1="15"
					y1="25"
					x2="25"
					y2="25"
					stroke="#990000"
					stroke-width="2"
				/>
				<line
					x1="15"
					y1="30"
					x2="25"
					y2="30"
					stroke="#990000"
					stroke-width="2"
				/>
				<line
					x1="15"
					y1="35"
					x2="25"
					y2="35"
					stroke="#990000"
					stroke-width="2"
				/>
			</svg>
		</div>
	</div>
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

	.wiper-container {
		position: fixed;
		bottom: 40px;
		left: 0;
		width: 100%; // Full width
		height: 60px;
		display: flex;
		align-items: center;
		touch-action: none;
	}

	.wiper-bar {
		position: absolute;
		width: 100%;
		height: 8px;
		background: #ddd;
		border-radius: 4px;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.wiper-knob {
		position: absolute;
		width: 40px;
		height: 60px;
		cursor: grab;
		user-select: none;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));

		&:active {
			cursor: grabbing;
		}
	}

	.wiper-line {
		position: absolute;
		z-index: 10;
		top: 0;
		height: 100%;
		width: 2px;
		border-left: dashed rgba(0, 0, 0, 0.1) 1px;
		pointer-events: none;
	}
</style>
