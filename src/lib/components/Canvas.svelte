<script>
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import letterF from '$lib/images/f.png';
	import letterA from '$lib/images/a.png';
	import letterT from '$lib/images/t.png';
	import letterE from '$lib/images/e.png';
	import letterM from '$lib/images/m.png';
	import letterA2 from '$lib/images/a2.png';

	let animationFrameId = null;
	let pendingRender = false;
	let lastRenderTime = 0;
	const FRAME_RATE = 60; // Target FPS
	const FRAME_INTERVAL = 1000 / FRAME_RATE;

	// Canvas setup
	let canvas;
	let ctx;
	let shouldDraw = true;
	let particles = [];
	let stampParticles = []; // For magnet stamps
	let lastX = null;
	let lastY = null;
	let wiperPosition = 0.5; // 0 to 1 range
	let isDraggingWiper = false;
	let lastWiperPosition = 0.5; // Add this at the top with other state variables
	let wiperKnobWidth = 40; // Width of the knob in pixels
	let selectedMagnet = null;
	let isDraggingMagnet = false;

	// Configuration for the drawing effect
	const CONFIG = {
		particleSize: 0.3, // Reduced from 2
		particleDensity: 15, // Increased for more particles
		lineWidth: 6, // Reduced from 12
		backgroundColor: '#e8e8e8',
		gridColor: '#d4d4d4',
		hexagonSize: 6,
		particleColor: '#636363',
		stampParticleColor: '#1a1a1a',
		stampWhiteParticleProbability: 0.1, // Separate probability for stamps
		whiteParticleProbability: 0.3, // For magnet stamps
	};

	let magnets = [];
	let magnetImages = {};

	// Initialize the canvas and set up event listeners
	onMount(() => {
		ctx = canvas.getContext('2d', { willReadFrequently: true });

		// Set canvas to full screen
		const resize = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
			drawHexagonGrid();
			positionMagnets(); // Reposition magnets on resize
		};

		window.addEventListener('resize', resize);
		resize();

		window.addEventListener('pointermove', handleWiperMove);
		window.addEventListener('pointerup', handleWiperUp);

		// Load all magnet images
		const letters = [
			{ src: letterF, id: 'F' },
			{ src: letterA, id: 'A' },
			{ src: letterT, id: 'T' },
			{ src: letterE, id: 'E' },
			{ src: letterM, id: 'M' },
			{ src: letterA2, id: 'A2' },
		];

		let loadedCount = 0;
		letters.forEach((letter) => {
			const img = new window.Image();
			img.src = letter.src;
			img.onload = () => {
				magnetImages[letter.id] = img;
				loadedCount++;
				if (loadedCount === letters.length) {
					initializeMagnets();
				}
			};
		});

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

	function scheduleRender() {
		if (!pendingRender) {
			pendingRender = true;
			animationFrameId = requestAnimationFrame((timestamp) => {
				pendingRender = false;
				renderAll(); // Use renderAll instead of renderParticles
				lastRenderTime = timestamp;
			});
		}
	}

	// Handle mouse/touch events
	function handlePointerDown(e) {
		shouldDraw = false;
		const pos = getPointerPos(e);
		// Check if clicking on a magnet first
		const clickedMagnet = findClickedMagnet(pos);

		if (clickedMagnet) {
			// Start magnet drag
			createMagnetStamp(clickedMagnet);
			isDraggingMagnet = true;
			selectedMagnet = clickedMagnet;
			selectedMagnet.isPickedUp = true;

			// Animate scale up
			gsap.to(selectedMagnet, {
				scale: 1.1,
				duration: 0.2,
				ease: 'power2.out',
				onUpdate: () => scheduleRender(),
			});
		} else {
			shouldDraw = false;
		}
	}

	function handlePointerUp(e) {
		if (isDraggingMagnet && selectedMagnet) {
			const pos = getPointerPos(e);
			const magnet = selectedMagnet;
			magnet.x = pos.x - magnet.width / 2;
			magnet.y = pos.y - magnet.height / 2;

			gsap.to(magnet, {
				scale: 1,
				duration: 0.2,
				ease: 'power2.in',
				onUpdate: () => scheduleRender(),
				onComplete: () => {
					magnet.isPickedUp = false;
					createMagnetStamp(magnet);
					isDraggingMagnet = false;
					selectedMagnet = null;
					scheduleRender();
				},
			});
		}
		shouldDraw = true;
		// Reset last positions to prevent line connecting to previous position
		lastX = null;
		lastY = null;
	}

	function handlePointerMove(e) {
		const pos = getPointerPos(e);

		if (isDraggingMagnet && selectedMagnet) {
			selectedMagnet.x = pos.x - selectedMagnet.width / 2;
			selectedMagnet.y = pos.y - selectedMagnet.height / 2;
			renderAll();
			lastX = pos.x;
			lastY = pos.y;
		} else if (shouldDraw && !isDraggingWiper) {
			if (lastX === null || lastY === null) {
				lastX = pos.x;
				lastY = pos.y;
				return;
			}
			// Add check for wiper
			generateParticles(lastX, lastY, pos.x, pos.y);
			scheduleRender();
			lastX = pos.x;
			lastY = pos.y;
		}
	}

	function handlePointerLeave(e) {
		const pos = getPointerPos(e);
		lastX = pos.x;
		lastY = pos.y;
	}

	// Update handleWiperDown to set initial position
	function handleWiperDown(e) {
		isDraggingWiper = true;
		lastWiperPosition = wiperPosition;
		shouldDraw = false;
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
		shouldDraw = true;
	}

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

		particles = particles.filter((p) => p.x < x1 - 1 || p.x > x2 + 1);
		stampParticles = stampParticles.filter((p) => p.x < x1 - 1 || p.x > x2 + 1);

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

		// Use scheduleRender instead of renderParticles
		scheduleRender();
	}

	function findClickedMagnet(pos) {
		return magnets.find((magnet) => {
			const scale = magnet.scale || 1;
			const centerX = magnet.x + (magnet.width * scale) / 2;
			const centerY = magnet.y + (magnet.height * scale) / 2;
			const scaledWidth = magnet.width * scale;
			const scaledHeight = magnet.height * scale;

			return (
				pos.x >= magnet.x &&
				pos.x <= magnet.x + scaledWidth &&
				pos.y >= magnet.y &&
				pos.y <= magnet.y + scaledHeight
			);
		});
	}

	function createMagnetStamp(magnet) {
		const tempCanvas = document.createElement('canvas');
		const tempCtx = tempCanvas.getContext('2d');

		// Make the temp canvas large enough to handle rotated image
		const diagonal = Math.sqrt(
			magnet.width * magnet.width + magnet.height * magnet.height
		);
		tempCanvas.width = diagonal * 2;
		tempCanvas.height = diagonal * 2;

		// Draw the rotated image onto the temp canvas
		tempCtx.save();
		tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
		tempCtx.rotate(magnet.rotation || 0);
		tempCtx.drawImage(
			magnet.img,
			-magnet.width / 2,
			-magnet.height / 2,
			magnet.width,
			magnet.height
		);
		tempCtx.restore();

		const imageData = tempCtx.getImageData(
			0,
			0,
			tempCanvas.width,
			tempCanvas.height
		);
		const data = imageData.data;

		const points = [];
		const alphaThreshold = 100;
		const particleDensity = {
			edge: 2, // Reduced from 4 to make outline less pronounced
			fill: 0.9,
		};

		const particleSize = {
			length: CONFIG.hexagonSize * 0.12, // Slightly reduced from 0.15
			width: CONFIG.hexagonSize * 0.025, // Slightly reduced from 0.03
			randomness: 0.15, // Reduced from 0.2 for more consistency
		};

		// Calculate offset to center the stamp particles around the magnet's position
		const offsetX = (tempCanvas.width - magnet.width) / 2;
		const offsetY = (tempCanvas.height - magnet.height) / 2;

		for (let y = 1; y < tempCanvas.height - 1; y++) {
			for (let x = 1; x < tempCanvas.width - 1; x++) {
				const idx = (y * tempCanvas.width + x) * 4;
				const alpha = data[idx + 3];

				if (alpha > alphaThreshold) {
					const leftAlpha = data[idx - 4 + 3];
					const rightAlpha = data[idx + 4 + 3];
					const topAlpha = data[idx - tempCanvas.width * 4 + 3];
					const bottomAlpha = data[idx + tempCanvas.width * 4 + 3];

					const isEdge =
						leftAlpha <= alphaThreshold ||
						rightAlpha <= alphaThreshold ||
						topAlpha <= alphaThreshold ||
						bottomAlpha <= alphaThreshold;

					if (isEdge) {
						// Reduced spread for edge particles
						for (let i = 0; i < particleDensity.edge; i++) {
							points.push({
								x: magnet.x - offsetX + x + (Math.random() - 0.5) * 0.8, // Reduced spread
								y: magnet.y - offsetY + y + (Math.random() - 0.5) * 0.8, // Reduced spread
								isEdge: true,
							});
						}
					} else if (Math.random() < particleDensity.fill) {
						points.push({
							x: magnet.x - offsetX + x + (Math.random() - 0.5) * 1.5,
							y: magnet.y - offsetY + y + (Math.random() - 0.5) * 1.5,
							isEdge: false,
						});
					}
				}
			}
		}

		points.forEach((point) => {
			const particle = {
				x: point.x,
				y: point.y,
				angle: Math.random() * Math.PI * 2,
				length:
					particleSize.length +
					Math.random() * particleSize.length * particleSize.randomness,
				width: particleSize.width,
				isStampParticle: true,
				color:
					Math.random() < CONFIG.stampWhiteParticleProbability
						? '#ffffff'
						: CONFIG.stampParticleColor,
			};

			stampParticles.push(particle);
		});

		scheduleRender();
	}

	function initializeMagnets() {
		const letters = ['F', 'A', 'T', 'E', 'M', 'A2'];
		const totalWidth = window.innerWidth * 0.4;
		const spacing = totalWidth / (letters.length - 1);
		const startX = (window.innerWidth - totalWidth) / 2;

		// Calculate a consistent visual height
		const targetHeight = window.innerHeight * 0.18; // 18vh base size

		magnets = letters.map((letter, index) => {
			const img = magnetImages[letter];
			const aspectRatio = img.width / img.height;
			// Scale height based on original image height to maintain consistent visual size
			const height = targetHeight * (1 + Math.random() * 0.1); // Only 10% variation
			const width = height * aspectRatio;

			return {
				id: letter,
				x: startX + spacing * index - width / 2,
				y: window.innerHeight * (0.3 + Math.random() * 0.2), // Moved up 10% (from 0.4 to 0.3)
				img: img,
				width,
				height,
				rotation: ((Math.random() * 60 - 30) * Math.PI) / 180,
				isPickedUp: false,
				scale: 1,
			};
		});

		renderAll();
	}

	function positionMagnets() {
		if (!magnets.length) return;

		const totalWidth = window.innerWidth * 0.4;
		const spacing = totalWidth / (magnets.length - 1);
		const startX = (window.innerWidth - totalWidth) / 2;
		const targetHeight = window.innerHeight * 0.18; // 18vh base size

		magnets.forEach((magnet, index) => {
			const aspectRatio = magnet.img.width / magnet.img.height;
			const height = targetHeight * (1 + Math.random() * 0.1); // Only 10% variation
			const width = height * aspectRatio;

			magnet.width = width;
			magnet.height = height;
			magnet.x = startX + spacing * index - width / 2;
			magnet.y = window.innerHeight * (0.3 + Math.random() * 0.2); // Moved up 10%
		});

		renderAll();
	}

	function renderMagnets() {
		magnets.forEach((magnet) => {
			if (magnet.img) {
				ctx.save();

				// Calculate center point for scaling and rotation
				const centerX = magnet.x + magnet.width / 2;
				const centerY = magnet.y + magnet.height / 2;

				// Apply transformations
				ctx.translate(centerX, centerY);
				ctx.scale(magnet.scale || 1, magnet.scale || 1);
				ctx.rotate(magnet.rotation || 0);
				ctx.translate(-magnet.width / 2, -magnet.height / 2);

				// Draw the magnet
				ctx.drawImage(magnet.img, 0, 0, magnet.width, magnet.height);

				ctx.restore();
			}
		});
	}

	// Add a function to render everything
	function renderAll() {
		// Clear and draw background
		ctx.fillStyle = CONFIG.backgroundColor;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Draw hexagon grid
		drawHexagonGrid();

		// Draw stamp particles first (always with their stored color)
		stampParticles.forEach((particle) => {
			ctx.fillStyle = particle.color;
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

		// Draw regular particles
		particles.forEach((particle) => {
			ctx.fillStyle = particle.isWhite ? '#ffffff' : CONFIG.particleColor;
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

		// Draw magnets last
		renderMagnets();
	}
</script>

<div class="canvas-container">
	<canvas
		bind:this={canvas}
		on:pointerdown={handlePointerDown}
		on:pointermove={handlePointerMove}
		on:pointerup={handlePointerUp}
		on:pointerleave={handlePointerLeave}
	></canvas>
	{#if isDraggingWiper}
		<div
			class="wiper-line"
			style="height: 100%"
			style:left={`${wiperPosition * 100}%`}
		></div>
	{/if}
	<div class="wiper-container">
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
