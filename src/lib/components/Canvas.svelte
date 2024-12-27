<script>
	import { onMount, onDestroy } from 'svelte';
	import { gsap } from 'gsap';
	import letterF from '$lib/images/f.png?url';
	import letterA from '$lib/images/a.png?url';
	import letterT from '$lib/images/t.png?url';
	import letterE from '$lib/images/e.png?url';
	import letterM from '$lib/images/m.png?url';
	import letterA2 from '$lib/images/a2.png?url';
	import cursorDefault from '$lib/images/cursor.png?url';
	import cursorHover from '$lib/images/glove-heavy.png?url';
	import cursorClick from '$lib/images/glove-clicked-heavy.png?url';
	import multiText from '$lib/images/multi-text.png';
	import ThreeScene from './ThreeScene.svelte';
	import ScrollToExplore from './ScrollToExplore.svelte';

	let animationFrameId = null;
	let pendingRender = false;
	let lastRenderTime = 0;
	const CONFIG = {
		particleSize: 0.3,
		particleDensity: 15,
		lineWidth: 6,
		backgroundColor: '#e8e8e8',
		gridColor: '#DADADA', // Lighter grid color
		hexagonSize: 2,
		particleLength: 6,
		particleWidth: 0.3,
		particleColor: '#333333',
		preDrawnParticleSize: 1.0,
		preDrawnDensity: 40,
		preDrawnColor: '#333333',
		whiteParticleProbability: 0.3,
		targetFPS: 60,
		hexagonSpacing: 2 * 3, // Size * multiplier
		hexagonAvoidanceDistance: 0.5, // Slightly stronger for drawn elements
		predrawnAvoidanceDistance: 0.4, // More subtle for predrawn elements
		stampAvoidanceDistance: 0.5, // Stamp elements
		hexagonLineWidth: 0.5, // Width of the hexagon line effect
		initialStampOpacity: 0.95, // Darker initial stamps
		subsequentStampOpacity: 0.6, // Lighter subsequent stamps
		initialStampDensity: {
			// Higher density for initial stamps
			edge: 2.5,
			fill: 2.8,
		},
		subsequentStampDensity: {
			// Lower density for subsequent stamps
			edge: 1.8,
			fill: 1.5,
		},
	};

	const FRAME_INTERVAL = 1000 / CONFIG.targetFPS;

	// Canvas setup
	let canvas;
	let screenCanvas;
	export let onScreenCanvasReady = () => {};
	let ctx;
	let shouldDraw = true;
	let particles = [];
	let stampParticles = []; // For magnet stamps
	let preDrawnParticles = []; // For pre-drawn elements
	let lastX = null;
	let lastY = null;
	let selectedMagnet = null;
	let isDraggingMagnet = false;
	let isHoveringMagnet = false;
	let isClicking = false;
	let hoveredMagnet = null;

	let cursorElement;
	let m = { x: 0, y: 0 };
	let cursorOpacity = 1;

	let lastMouseX = 0;
	let lastMouseY = 0;
	let mouseVelocityX = 0;
	let mouseVelocityY = 0;

	let magnets = [];
	let magnetImages = {};
	let selectedMagnetIndex = -1; // Track the original index of selected magnet

	// Add spatial hash grid system
	class SpatialHashGrid {
		constructor(cellSize) {
			this.cellSize = cellSize;
			this.grid = new Map();
		}

		// Get grid cell key for a position
		getCellKey(x, y) {
			const gridX = Math.floor(x / this.cellSize);
			const gridY = Math.floor(y / this.cellSize);
			return `${gridX},${gridY}`;
		}

		// Get all neighboring cell keys
		getNeighborKeys(x, y) {
			const gridX = Math.floor(x / this.cellSize);
			const gridY = Math.floor(y / this.cellSize);
			const keys = [];

			// Get 9 neighboring cells (including current cell)
			for (let i = -1; i <= 1; i++) {
				for (let j = -1; j <= 1; j++) {
					keys.push(`${gridX + i},${gridY + j}`);
				}
			}
			return keys;
		}

		// Add particle to grid
		addParticle(particle) {
			const key = this.getCellKey(particle.x, particle.y);
			if (!this.grid.has(key)) {
				this.grid.set(key, new Set());
			}
			this.grid.get(key).add(particle);
		}

		// Remove particle from grid
		removeParticle(particle) {
			const key = this.getCellKey(particle.x, particle.y);
			const cell = this.grid.get(key);
			if (cell) {
				cell.delete(particle);
				if (cell.size === 0) {
					this.grid.delete(key);
				}
			}
		}

		// Query particles in proximity
		queryParticles(x, y, radius) {
			const nearbyParticles = new Set();
			const neighborKeys = this.getNeighborKeys(x, y);

			for (const key of neighborKeys) {
				const cell = this.grid.get(key);
				if (cell) {
					for (const particle of cell) {
						const dx = particle.x - x;
						const dy = particle.y - y;
						const distSq = dx * dx + dy * dy;
						if (distSq < radius * radius) {
							nearbyParticles.add(particle);
						}
					}
				}
			}
			return nearbyParticles;
		}

		// Clear all particles
		clear() {
			this.grid.clear();
		}
	}

	// Initialize spatial hash grid with cell size slightly larger than proximity threshold
	const spatialGrid = new SpatialHashGrid(2);

	function bringMagnetToFront(magnet) {
		// Remove the magnet from its current position
		const magnetIndex = magnets.indexOf(magnet);
		if (magnetIndex > -1) {
			magnets.splice(magnetIndex, 1);
			// Add it to the end of the array (top of render stack)
			magnets.push(magnet);
		}
		scheduleRender();
	}

	function restoreMagnetPosition(magnet, originalIndex) {
		if (originalIndex === -1) return;

		// Remove the magnet from its current position
		const magnetIndex = magnets.indexOf(magnet);
		if (magnetIndex > -1) {
			magnets.splice(magnetIndex, 1);
			// Insert it back at its original position
			magnets.splice(originalIndex, 0, magnet);
		}
		scheduleRender();
	}

	// Initialize the canvas and set up event listeners
	onMount(() => {
		if (!canvas) return;
		ctx = canvas.getContext('2d', { willReadFrequently: true });

		// Initialize screen canvas
		screenCanvas = document.createElement('canvas');
		screenCanvas.width = window.innerWidth;
		screenCanvas.height = window.innerHeight;
		onScreenCanvasReady(screenCanvas);

		// Set canvas to full screen
		const resize = () => {
			if (!canvas) return;
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
			// Recreate pre-drawn elements after resize
			gridCache = null; // Clear grid cache on resize
			preDrawnParticles = [];

			// First create pre-drawn text
			createPreDrawnElements();

			// Then recreate stamps for any existing magnets
			if (magnets.length > 0) {
				magnets.forEach((magnet) => {
					createMagnetStamp(magnet);
				});
			}

			// Finally render everything
			renderAll();
		};

		window.addEventListener('resize', resize);
		resize();

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
					scheduleRender();
				}
			};
		});

		// Register GSAP plugin
		gsap.registerPlugin();

		// Add pre-drawn elements after canvas is initialized
		createPreDrawnElements();

		// Start the render loop with proper timing
		function renderLoop() {
			scheduleRender();
			animationFrameId = requestAnimationFrame(renderLoop);
		}
		renderLoop();

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
			const ctx = gridCache.getContext('2d');

			// Set up line style
			ctx.strokeStyle = CONFIG.gridColor;
			ctx.lineWidth = 1;

			const size = CONFIG.hexagonSize * 3; // Back to 3x multiplier
			const width = size * Math.sqrt(3);
			const height = size * 2;
			const verticalSpacing = height * 0.75;

			// Calculate number of hexagons needed
			const columns = Math.ceil(canvas.width / width) + 1;
			const rows = Math.ceil(canvas.height / verticalSpacing) + 1;

			// Draw each hexagon
			for (let row = 0; row < rows; row++) {
				const isOddRow = row % 2 === 1;
				const offsetX = isOddRow ? width / 2 : 0;

				for (let col = -1; col < columns; col++) {
					const x = col * width + offsetX;
					const y = row * verticalSpacing;
					drawHexagon(ctx, x, y, size);
				}
			}
		}

		// Draw the cached grid
		ctx.drawImage(gridCache, 0, 0);
	}

	function drawHexagon(ctx, x, y, size) {
		ctx.beginPath();
		for (let i = 0; i < 6; i++) {
			const angle = (i * Math.PI) / 3 - Math.PI / 6; // Rotate to flat-top orientation
			const px = x + size * Math.cos(angle);
			const py = y + size * Math.sin(angle);
			if (i === 0) {
				ctx.moveTo(px, py);
			} else {
				ctx.lineTo(px, py);
			}
		}
		ctx.closePath();
		ctx.stroke();
	}

	// Update resize handler to clear cache
	const resize = () => {
		if (!canvas) return;
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		gridCache = null; // Clear cache on resize
		drawHexagonGrid();
	};

	// Shared particle creation function
	function createParticle(x, y, isStampParticle = false, isPredrawn = false) {
		const angle = Math.random() * Math.PI * 2;

		// Apply noise at creation time instead of render time
		let finalX = x;
		let finalY = y;
		if (!isStampParticle) {
			finalX += (Math.random() - 0.5) * 1.5;
			finalY += (Math.random() - 0.5) * 1.5;
		}

		return {
			x: finalX,
			y: finalY,
			angle: angle + ((Math.random() - 0.5) * Math.PI) / 6,
			length: CONFIG.particleLength * (0.2 + Math.random() * 0.3),
			width: CONFIG.particleWidth,
			isStampParticle,
			isPredrawn,
			isWhite: Math.random() < CONFIG.whiteParticleProbability,
		};
	}

	// Function to check if a point is near a hexagon line
	function isNearHexagonLine(x, y, avoidanceDistance) {
		const size = CONFIG.hexagonSize * 3;
		const hexHeight = size * Math.sqrt(3);

		// Get nearest hexagon centers (check multiple nearby hexagons)
		for (let colOffset = -1; colOffset <= 1; colOffset++) {
			for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
				// Offset every other column for proper hexagonal tiling
				const isOddRow = Math.round(y / hexHeight) % 2 === 1;
				const colAdjustment = isOddRow ? 0.5 : 0;

				const col = Math.round(x / (size * 1.5) - colAdjustment) + colOffset;
				const row = Math.round(y / hexHeight) + rowOffset;

				// Calculate center with offset for odd rows
				const centerX = (col + (isOddRow ? colAdjustment : 0)) * size * 1.5;
				const centerY = row * hexHeight;

				// Check distance to each vertex of the hexagon
				const vertices = [];
				for (let i = 0; i < 6; i++) {
					const angle = (i * Math.PI) / 3 - Math.PI / 6;
					vertices.push({
						x: centerX + size * Math.cos(angle),
						y: centerY + size * Math.sin(angle),
					});
				}

				// Check each edge of the hexagon
				for (let i = 0; i < 6; i++) {
					const v1 = vertices[i];
					const v2 = vertices[(i + 1) % 6];

					// Calculate distance from point to line segment
					const edgeX = v2.x - v1.x;
					const edgeY = v2.y - v1.y;
					const edgeLength = Math.sqrt(edgeX * edgeX + edgeY * edgeY);

					// Calculate normalized edge vector
					const edgeNormalX = edgeX / edgeLength;
					const edgeNormalY = edgeY / edgeLength;

					// Calculate vector from point to first vertex
					const pointX = x - v1.x;
					const pointY = y - v1.y;

					// Project point onto edge
					const projection = pointX * edgeNormalX + pointY * edgeNormalY;

					// Find closest point on edge
					let closestX, closestY;
					if (projection <= 0) {
						closestX = v1.x;
						closestY = v1.y;
					} else if (projection >= edgeLength) {
						closestX = v2.x;
						closestY = v2.y;
					} else {
						closestX = v1.x + edgeNormalX * projection;
						closestY = v1.y + edgeNormalY * projection;
					}

					// Calculate distance to closest point
					const dx = x - closestX;
					const dy = y - closestY;
					const distance = Math.sqrt(dx * dx + dy * dy);

					if (distance < avoidanceDistance) {
						return {
							isNear: true,
							dx: dx / distance,
							dy: dy / distance,
						};
					}
				}
			}
		}

		return { isNear: false };
	}

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

			particles.push(createParticle(x + perpX, y + perpY));
		}
	}

	// Get pointer position relative to canvas
	const CURSOR_OFFSET_X = 0.62; // Increased X offset
	const CURSOR_OFFSET_Y = 0.42; // Keep Y offset the same

	function getPointerPos(e) {
		const rect = canvas.getBoundingClientRect();
		// Convert rem to pixels using current root font size
		const remToPx = parseFloat(
			getComputedStyle(document.documentElement).fontSize
		);
		const offsetXPx = CURSOR_OFFSET_X * remToPx;
		const offsetYPx = CURSOR_OFFSET_Y * remToPx;

		return {
			x: e.clientX - rect.left + offsetXPx,
			y: e.clientY - rect.top + offsetYPx,
		};
	}

	function scheduleRender() {
		const currentTime = performance.now();
		const timeSinceLastRender = currentTime - lastRenderTime;

		if (!pendingRender && timeSinceLastRender >= FRAME_INTERVAL) {
			pendingRender = true;
			animationFrameId = requestAnimationFrame(() => {
				pendingRender = false;
				renderAll();
				lastRenderTime = performance.now();
			});
		}
	}

	// Handle mouse/touch events
	function handlePointerDown(e) {
		shouldDraw = false;
		const pos = getPointerPos(e);
		const x = pos.x;
		const y = pos.y;
		// Check if clicking on a magnet first
		const clickedMagnet = findClickedMagnet(pos);

		if (clickedMagnet) {
			// Start magnet drag
			isDraggingMagnet = true;
			selectedMagnet = clickedMagnet;
			selectedMagnet.isPickedUp = true;
			selectedMagnetIndex = magnets.indexOf(clickedMagnet);
			bringMagnetToFront(clickedMagnet);

			// Animate scale up
			gsap.to(selectedMagnet, {
				scale: 1.1,
				duration: 0.2,
				ease: 'power2.out',
				onUpdate: () => scheduleRender(),
			});

			lastMouseX = e.clientX;
			lastMouseY = e.clientY;
			mouseVelocityX = 0;
			mouseVelocityY = 0;
		} else {
			shouldDraw = false;
		}
	}

	function handlePointerUp(e) {
		if (isDraggingMagnet && selectedMagnet) {
			const magnet = selectedMagnet;
			// Keep the magnet exactly where it is
			magnet.x = e.clientX + magnet.grabOffsetX;
			magnet.y = e.clientY + magnet.grabOffsetY;

			gsap.to(magnet, {
				scale: 1,
				duration: 0.6,
				ease: 'power3.out',
				onUpdate: () => scheduleRender(),
				onComplete: () => {
					magnet.isPickedUp = false;
					isDraggingMagnet = false;
					// Create stamp after animation completes with final position
					createMagnetStamp(magnet);
					restoreMagnetPosition(magnet, selectedMagnetIndex);
					selectedMagnet = null;
					selectedMagnetIndex = -1;
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
			updateMouseVelocity(e);
			selectedMagnet.x = e.clientX + selectedMagnet.grabOffsetX;
			selectedMagnet.y = e.clientY + selectedMagnet.grabOffsetY;

			// Calculate rotation based on movement velocity
			const velocityRotation = mouseVelocityX * 0.5; // Adjust multiplier for sensitivity
			const targetRotation = Math.max(Math.min(velocityRotation, 25), -25); // Clamp between -25 and 25 degrees

			gsap.to(selectedMagnet, {
				rotation: targetRotation,
				duration: 0.3,
				ease: 'power1.out',
			});

			scheduleRender();
		} else if (shouldDraw) {
			if (lastX === null || lastY === null) {
				lastX = pos.x;
				lastY = pos.y;
				return;
			}
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
		if (!magnet || !magnet.img || !magnet.img.complete) return;

		// Skip if magnet is currently being stamped
		if (magnet.isStamping) {
			return;
		}

		magnet.isStamping = true;

		const tempCanvas = document.createElement('canvas');
		const tempCtx = tempCanvas.getContext('2d');

		// Make the temp canvas large enough to handle rotated image
		const maxDimension = Math.ceil(
			Math.sqrt(magnet.width * magnet.width + magnet.height * magnet.height)
		);
		tempCanvas.width = maxDimension;
		tempCanvas.height = maxDimension;

		// Center and rotate
		tempCtx.save();
		tempCtx.translate(maxDimension / 2, maxDimension / 2);
		tempCtx.rotate(((magnet.rotation || 0) * Math.PI) / 180);
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

		// Determine if this is the initial stamp for this magnet
		const isInitialStamp = !stampParticles.some(
			(p) => p.magnetId === magnet.id
		);

		// Use different densities based on whether this is the initial stamp
		const particleDensity = isInitialStamp
			? CONFIG.initialStampDensity
			: CONFIG.subsequentStampDensity;

		const particleSize = {
			length: CONFIG.particleLength * (0.2 + Math.random() * 0.3),
			width: CONFIG.particleWidth,
			randomness: 0.15,
		};

		// Calculate offset to center the stamp particles around the magnet's position
		const offsetX = (tempCanvas.width - magnet.width) / 2;
		const offsetY = (tempCanvas.height - magnet.height) / 2;

		// Function to check if a point already has a stamp nearby using spatial grid
		const proximityThreshold = 1.5;
		function hasNearbyStamp(x, y) {
			const nearbyParticles = spatialGrid.queryParticles(
				x,
				y,
				proximityThreshold
			);
			return nearbyParticles.size > 0;
		}

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

					const newX = magnet.x + (x - offsetX);
					const newY = magnet.y + (y - offsetY);

					if (isEdge) {
						for (let i = 0; i < particleDensity.edge; i++) {
							const finalX = newX + (Math.random() - 0.5) * 0.8;
							const finalY = newY + (Math.random() - 0.5) * 0.8;
							if (!hasNearbyStamp(finalX, finalY)) {
								points.push({
									x: finalX,
									y: finalY,
									isEdge: true,
								});
							}
						}
					} else if (Math.random() < particleDensity.fill) {
						const finalX = newX + (Math.random() - 0.5) * 1.5;
						const finalY = newY + (Math.random() - 0.5) * 1.5;
						if (!hasNearbyStamp(finalX, finalY)) {
							points.push({
								x: finalX,
								y: finalY,
								isEdge: false,
							});
						}
					}
				}
			}
		}

		points.forEach((point) => {
			const particle = createParticle(point.x, point.y, true);
			particle.magnetId = magnet.id;
			particle.opacity = isInitialStamp
				? CONFIG.initialStampOpacity
				: CONFIG.subsequentStampOpacity;
			stampParticles.push(particle);
			spatialGrid.addParticle(particle); // Add to spatial grid
		});

		// Reset the stamping flag after a delay
		setTimeout(() => {
			magnet.isStamping = false;
		}, 300);

		scheduleRender();
	}

	function getLetterHeight(letter) {
		// Define height ranges for different letter groups - middle ground between previous versions
		const heights = {
			high: { base: 0.3, variance: 0.01 }, // 30-31vh from top
			middle: { base: 0.35, variance: 0.01 }, // 35-36vh from top
			low: { base: 0.4, variance: 0.01 }, // 40-41vh from top
		};

		switch (letter) {
			case 'F':
			case 'E':
			case 'A2':
				return heights.high.base + Math.random() * heights.high.variance;
			case 'T':
				return heights.middle.base + Math.random() * heights.middle.variance;
			case 'A':
			case 'M':
				return heights.low.base + Math.random() * heights.low.variance;
			default:
				return 0.35; // fallback to middle
		}
	}

	function getLetterOffset(letter, index) {
		// Add specific offsets for F and A
		switch (letter) {
			case 'F':
				return window.innerWidth * 0.03; // Move F right by 3vw
			case 'A':
				if (index === 1) {
					// Only the first A
					return window.innerWidth * 0.01; // Move A right by 6vw (3vw more than F to reduce gap)
				}
				return 0;
			default:
				return 0;
		}
	}

	function initializeMagnets() {
		const letters = ['F', 'A', 'T', 'E', 'M', 'A2'];
		const totalWidth = window.innerWidth * 0.4;
		const spacing = totalWidth / (letters.length - 1);
		const startX = (window.innerWidth - totalWidth) / 2;

		// Compensate for the rightward shift from letter offsets
		const groupOffset = window.innerWidth * -0.02; // Shift everything left by 2vw to recenter

		// Calculate a consistent visual height
		const targetHeight = window.innerHeight * 0.18; // 18vh base size

		magnets = letters.map((letter, index) => {
			const img = magnetImages[letter];
			const aspectRatio = img.width / img.height;
			const height = targetHeight * (1 + Math.random() * 0.1);
			const width = height * aspectRatio;
			const offset = getLetterOffset(letter, index);

			return {
				id: letter,
				x: startX + spacing * index - width / 2 + offset + groupOffset,
				y: window.innerHeight * getLetterHeight(letter),
				img: img,
				width,
				height,
				rotation: 0, // Add initial rotation
				isPickedUp: false,
				scale: 1,
				grabOffsetX: 0,
				grabOffsetY: 0,
			};
		});

		renderAll();
	}

	function positionMagnets() {
		if (!magnets.length) return;

		const totalWidth = window.innerWidth * 0.4;
		const spacing = totalWidth / (magnets.length - 1);
		const startX = (window.innerWidth - totalWidth) / 2;
		const targetHeight = window.innerHeight * 0.18;
		const groupOffset = window.innerWidth * -0.02; // Same offset as in initializeMagnets

		magnets.forEach((magnet, index) => {
			const aspectRatio = magnet.img.width / magnet.img.height;
			const height = targetHeight * (1 + Math.random() * 0.1);
			const width = height * aspectRatio;
			const offset = getLetterOffset(magnet.id, index);

			magnet.width = width;
			magnet.height = height;
			magnet.x = startX + spacing * index - width / 2 + offset + groupOffset;
			magnet.y = window.innerHeight * getLetterHeight(magnet.id);
			magnet.rotation = 0;
		});

		renderAll();
	}

	// Add batch rendering utilities
	class ParticleBatch {
		constructor() {
			this.particles = new Map(); // Map of opacity -> particles array
		}

		add(particle) {
			const key = particle.opacity || 1;
			if (!this.particles.has(key)) {
				this.particles.set(key, []);
			}
			this.particles.get(key).push(particle);
		}

		clear() {
			this.particles.clear();
		}

		// Render all particles in batch with same opacity
		render(ctx) {
			for (const [opacity, particles] of this.particles) {
				// Draw all particles with this opacity
				for (const particle of particles) {
					// Skip if particle is outside viewport
					if (!isInViewport(particle)) continue;

					// Check hexagon line avoidance
					let avoidanceDistance;
					if (particle.isPredrawn) {
						avoidanceDistance = CONFIG.predrawnAvoidanceDistance;
					} else if (particle.isStampParticle) {
						avoidanceDistance = CONFIG.stampAvoidanceDistance;
					} else {
						avoidanceDistance = CONFIG.hexagonAvoidanceDistance;
					}

					const hexCheck = isNearHexagonLine(
						particle.x,
						particle.y,
						avoidanceDistance
					);

					if (hexCheck.isNear) {
						continue;
					}

					// Set color and opacity
					const color = particle.isWhite ? '#ffffff' : CONFIG.particleColor;
					const r = parseInt(color.slice(1, 3), 16);
					const g = parseInt(color.slice(3, 5), 16);
					const b = parseInt(color.slice(5, 7), 16);
					const finalOpacity =
						particle.opacity !== undefined ? particle.opacity : opacity;
					ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${finalOpacity})`;

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
				}
			}
		}
	}

	// Viewport check utility
	function isInViewport(particle) {
		// Add padding to account for particle size and rotation
		const padding = Math.max(particle.length, particle.width) * 2;
		return (
			particle.x + padding >= 0 &&
			particle.x - padding <= canvas.width &&
			particle.y + padding >= 0 &&
			particle.y - padding <= canvas.height
		);
	}

	// Create batch renderers for different particle types
	const stampBatch = new ParticleBatch();
	const drawingBatch = new ParticleBatch();
	const predrawnBatch = new ParticleBatch();

	// Update renderAll to use batch rendering
	function renderAll() {
		if (!ctx) return;

		// Clear and draw background
		ctx.fillStyle = CONFIG.backgroundColor;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Draw hexagon grid (already cached)
		drawHexagonGrid();

		// Clear batches
		stampBatch.clear();
		drawingBatch.clear();
		predrawnBatch.clear();

		// Sort particles into batches
		if (stampParticles.length > 0) {
			for (const particle of stampParticles) {
				stampBatch.add(particle);
			}
		}

		if (preDrawnParticles.length > 0) {
			for (const particle of preDrawnParticles) {
				predrawnBatch.add(particle);
			}
		}

		if (particles.length > 0) {
			for (const particle of particles) {
				drawingBatch.add(particle);
			}
		}

		// Render batches
		ctx.save();
		stampBatch.render(ctx);
		predrawnBatch.render(ctx);
		drawingBatch.render(ctx);
		ctx.restore();

		// Draw magnets last
		if (magnets.length > 0) {
			renderMagnets();
		}

		// Copy to screen canvas
		if (screenCanvas) {
			const screenCtx = screenCanvas.getContext('2d');
			screenCanvas.width = canvas.width;
			screenCanvas.height = canvas.height;
			screenCtx.drawImage(canvas, 0, 0);
			screenCanvas.dispatchEvent(new Event('canvasUpdate'));
		}
	}

	// Function to create particles along a path
	function createParticlesAlongPath(points, options = {}) {
		const defaultOptions = {
			particleSize: CONFIG.particleSize,
			density: CONFIG.particleDensity,
			randomOffset: CONFIG.lineWidth * 0.3,
		};
		const opts = { ...defaultOptions, ...options };

		for (let i = 1; i < points.length; i++) {
			const start = points[i - 1];
			const end = points[i];
			const distance = Math.sqrt(
				Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
			);
			const particleCount = Math.floor(distance * opts.density);

			// If we're at max particles, remove oldest ones
			if (preDrawnParticles.length + particleCount > MAX_PARTICLES) {
				preDrawnParticles = preDrawnParticles.slice(
					-(MAX_PARTICLES - particleCount)
				);
			}

			for (let j = 0; j < particleCount; j++) {
				const ratio = j / particleCount;
				const x = start.x + (end.x - start.x) * ratio;
				const y = start.y + (end.y - start.y) * ratio;

				const offset = (Math.random() - 0.5) * opts.randomOffset;
				const angle =
					Math.atan2(end.y - start.y, end.x - start.x) + Math.PI / 2;

				preDrawnParticles.push({
					x: x + (Math.random() - 0.5) * opts.randomOffset,
					y: y + (Math.random() - 0.5) * opts.randomOffset,
					angle: angle + (Math.random() - 0.5) * 0.2,
					length: opts.particleSize * (0.8 + Math.random() * 0.4),
					width: opts.particleSize * 0.3,
					color: CONFIG.preDrawnColor,
					isPredrawn: true,
				});
			}
		}
	}

	function createPreDrawnElements() {
		const img = new Image();
		img.onload = () => {
			// Create temporary canvas for image
			const tempCanvas = document.createElement('canvas');
			const tempCtx = tempCanvas.getContext('2d');

			// Calculate scaled dimensions while maintaining aspect ratio
			const scale = 0.35;
			const aspectRatio = img.width / img.height;
			const maxWidth = canvas.width * 0.8; // Max 80% of canvas width
			const maxHeight = canvas.height * 0.8; // Max 80% of canvas height

			let scaledWidth = img.width * scale;
			let scaledHeight = img.height * scale;

			// Ensure dimensions don't exceed canvas bounds while maintaining aspect ratio
			if (scaledWidth > maxWidth) {
				scaledWidth = maxWidth;
				scaledHeight = scaledWidth / aspectRatio;
			}
			if (scaledHeight > maxHeight) {
				scaledHeight = maxHeight;
				scaledWidth = scaledHeight * aspectRatio;
			}

			// Draw image at original size first
			tempCanvas.width = img.width;
			tempCanvas.height = img.height;
			tempCtx.drawImage(img, 0, 0);

			// Get image data
			const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
			const data = imageData.data;

			// Position in bottom right with padding
			const padding = 120;
			const startX = canvas.width - scaledWidth - padding;
			const startY = canvas.height - padding;

			// Calculate sampling parameters based on scale
			const pixelStep = Math.max(1, Math.floor(1 / scale)); // Skip pixels based on scale
			const particleSpacing = 1.2;

			// Track sampled positions to avoid duplicates
			const sampledPositions = new Set();

			for (let y = 0; y < img.height; y += pixelStep) {
				for (let x = 0; x < img.width; x += pixelStep) {
					const i = (y * img.width + x) * 4;
					if (data[i + 3] > 50) {
						// If pixel is visible enough
						// Calculate scaled position
						const scaledX = (x / img.width) * scaledWidth;
						const scaledY = (y / img.height) * scaledHeight;

						// Create unique key for this position
						const posKey = `${Math.floor(scaledX)},${Math.floor(scaledY)}`;

						// Only create particle if position hasn't been sampled
						if (
							!sampledPositions.has(posKey) &&
							Math.random() < 1 / particleSpacing
						) {
							sampledPositions.add(posKey);

							const wobble = 0.8;
							const offsetX = (Math.random() - 0.5) * wobble;
							const offsetY = (Math.random() - 0.5) * wobble;

							const sizeVariation = 0.7 + Math.random() * 0.6;

							preDrawnParticles.push({
								x: startX + scaledX + offsetX,
								y: startY + scaledY + offsetY - scaledHeight,
								angle: Math.random() * Math.PI * 2,
								length: CONFIG.preDrawnParticleSize * sizeVariation,
								width: CONFIG.preDrawnParticleSize * 0.5 * sizeVariation,
								color: CONFIG.preDrawnColor,
								isPredrawn: true,
							});
						}
					}
				}
			}

			// Force a render after loading image
			renderAll();
		};

		img.src = multiText;
	}

	// Render magnets
	function renderMagnets() {
		magnets.forEach((magnet) => {
			if (magnet.img) {
				ctx.save();

				// Calculate center point for scaling and rotation
				const centerX = magnet.x + magnet.width / 2;
				const centerY = magnet.y + magnet.height / 2;

				// Apply transformations
				if (isDraggingMagnet && magnet === selectedMagnet) {
					// For dragging magnet, rotate around cursor point
					const cursorX = m.x;
					const cursorY = m.y;

					ctx.translate(cursorX, cursorY);
					ctx.rotate(((magnet.rotation || 0) * Math.PI) / 180);
					ctx.scale(magnet.scale || 1, magnet.scale || 1);
					ctx.translate(-cursorX, -cursorY);

					ctx.drawImage(
						magnet.img,
						magnet.x,
						magnet.y,
						magnet.width,
						magnet.height
					);
				} else {
					// For static magnets, rotate around center as before
					ctx.translate(centerX, centerY);
					ctx.rotate(((magnet.rotation || 0) * Math.PI) / 180);
					ctx.scale(magnet.scale || 1, magnet.scale || 1);
					ctx.translate(-magnet.width / 2, -magnet.height / 2);

					ctx.drawImage(magnet.img, 0, 0, magnet.width, magnet.height);
				}

				ctx.restore();
			}
		});
	}

	// Handle mouse events
	function handleMousemove(event) {
		m.x = event.clientX;
		m.y = event.clientY;

		// Check if hovering over any magnet
		if (canvas) {
			const rect = canvas.getBoundingClientRect();
			const x = event.clientX - rect.left;
			const y = event.clientY - rect.top;

			isHoveringMagnet = magnets.some((magnet) => {
				const magnetBounds = {
					left: magnet.x - 10, // Add some padding for easier hovering
					right: magnet.x + magnet.width + 10,
					top: magnet.y - 10,
					bottom: magnet.y + magnet.height + 10,
				};

				return (
					x >= magnetBounds.left &&
					x <= magnetBounds.right &&
					y >= magnetBounds.top &&
					y <= magnetBounds.bottom
				);
			});
			hoveredMagnet = findClickedMagnet({ x, y });
		}
	}

	function handleMousedown(e) {
		isClicking = true;

		if (isHoveringMagnet && hoveredMagnet) {
			isDraggingMagnet = true;
			selectedMagnet = hoveredMagnet;
			selectedMagnet.grabOffsetX = hoveredMagnet.x - e.clientX;
			selectedMagnet.grabOffsetY = hoveredMagnet.y - e.clientY;
			lastMouseX = e.clientX;
			lastMouseY = e.clientY;
			mouseVelocityX = 0;
			mouseVelocityY = 0;
			// Create initial stamp before scaling up
			createMagnetStamp(hoveredMagnet);
			// Scale up animation on pickup
			gsap.to(selectedMagnet, {
				scale: 1.1,
				duration: 0.2,
				ease: 'power2.out',
			});
		}
	}

	function handleMouseup(e) {
		isClicking = false;

		if (isDraggingMagnet && selectedMagnet) {
			const droppedMagnet = selectedMagnet;
			isDraggingMagnet = false;
			const finalX = e.clientX + droppedMagnet.grabOffsetX;
			const finalY = e.clientY + droppedMagnet.grabOffsetY;
			const finalRotation = Math.round(droppedMagnet.rotation / 5) * 5;

			// Check for collisions with other magnets
			let collidedMagnet = null;
			for (const other of magnets) {
				if (other === droppedMagnet) continue;
				if (
					checkCollision(
						{
							x: finalX,
							y: finalY,
							width: droppedMagnet.width,
							height: droppedMagnet.height,
						},
						other
					)
				) {
					collidedMagnet = other;
					break;
				}
			}

			if (collidedMagnet) {
				// Find free space for the bottom magnet
				const newPosition = findFreeSpace(collidedMagnet, magnets);
				if (newPosition) {
					// Move the bottom magnet with more subtle animation
					gsap.to(collidedMagnet, {
						x: newPosition.x,
						y: newPosition.y,
						duration: 0.4,
						ease: 'power2.out',
						onUpdate: () => scheduleRender(),
					});
				}
			}

			// Animate position, rotation, and scale together
			gsap.to(droppedMagnet, {
				x: finalX,
				y: finalY,
				rotation: finalRotation,
				scale: 1.0,
				duration: 0.2,
				ease: 'power2.out',
				onComplete: () => {
					createMagnetStamp(droppedMagnet);
					scheduleRender();
				},
			});

			selectedMagnet = null;
		}
	}

	function updateMouseVelocity(e) {
		if (!lastMouseX || !lastMouseY) {
			lastMouseX = e.clientX;
			lastMouseY = e.clientY;
			return;
		}

		mouseVelocityX = e.clientX - lastMouseX;
		mouseVelocityY = e.clientY - lastMouseY;
		lastMouseX = e.clientX;
		lastMouseY = e.clientY;
	}

	function checkCollision(magnet1, magnet2) {
		return !(
			magnet1.x > magnet2.x + magnet2.width ||
			magnet1.x + magnet1.width < magnet2.x ||
			magnet1.y > magnet2.y + magnet2.height ||
			magnet1.y + magnet1.height < magnet2.y
		);
	}

	function remToPixels(rem) {
		return (
			rem * parseFloat(getComputedStyle(document.documentElement).fontSize)
		);
	}

	function findFreeSpace(magnet, otherMagnets) {
		const spacingRem = 0.2; // Work with rem values directly
		let x = magnet.x;
		let y = magnet.y;
		let radiusRem = spacingRem;
		let angle = 0;

		while (radiusRem < 25) {
			// Keep using rem values for the radius check
			// Convert rem to pixels only for the actual position calculation
			const radiusPixels = remToPixels(radiusRem);
			x = magnet.x + radiusPixels * Math.cos(angle);
			y = magnet.y + radiusPixels * Math.sin(angle);

			// Create temporary magnet at test position
			const testMagnet = { ...magnet, x, y };

			// Check if this position collides with any other magnet
			let hasCollision = false;
			for (const other of otherMagnets) {
				if (other === magnet) continue;
				if (checkCollision(testMagnet, other)) {
					hasCollision = true;
					break;
				}
			}

			if (!hasCollision) {
				return { x, y };
			}

			angle += Math.PI / 4; // 45-degree increments
			if (angle >= Math.PI * 2) {
				angle = 0;
				radiusRem += spacingRem; // Increment using rem values
			}
		}

		return null; // No free space found
	}

	function handleCanvasMouseEnter() {
		cursorOpacity = 1;
	}

	function handleCanvasMouseLeave() {
		cursorOpacity = 0;
	}

	let threeSceneComponent;
	let scrollToExploreComponent;
	let hasTriggeredTransition = false;

	function handleWheel(event) {
		if (!hasTriggeredTransition) {
			hasTriggeredTransition = true;
			if (scrollToExploreComponent && !scrollToExploreComponent.hasAnimated) {
				scrollToExploreComponent.startAnimation();
			}
			if (threeSceneComponent) {
				threeSceneComponent.startTransition();
			}
		}
	}
</script>

<svelte:window
	on:mousemove={handleMousemove}
	on:mousedown={handleMousedown}
	on:mouseup={handleMouseup}
	on:wheel={handleWheel}
/>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="canvas-container"
	on:mouseenter={handleCanvasMouseEnter}
	on:mouseleave={handleCanvasMouseLeave}
>
	<canvas
		bind:this={canvas}
		on:pointerdown={handlePointerDown}
		on:pointermove={handlePointerMove}
		on:pointerup={handlePointerUp}
		on:pointerleave={handlePointerLeave}
	></canvas>
	<ThreeScene bind:this={threeSceneComponent} />
	<div class="scroll-indicator">
		<ScrollToExplore bind:this={scrollToExploreComponent} />
	</div>
</div>

<div
	class="custom-cursor"
	bind:this={cursorElement}
	style="
		transform: translate({m.x}px, {m.y}px);
		background-image: url('{isClicking && isHoveringMagnet
		? cursorClick
		: isHoveringMagnet
			? cursorHover
			: cursorDefault}');
		opacity: {cursorOpacity};
	"
></div>

<style lang="scss">
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		cursor: none; /* Hide the default cursor */
	}

	.canvas-container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: #e8e8e8;
	}

	.scroll-indicator {
		position: absolute;
		top: 40px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10;
		opacity: 0.8;
		transition: opacity 0.3s ease;
		width: 16vw;
		pointer-events: none;
	}

	.scroll-indicator:hover {
		opacity: 1;
	}

	canvas {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		touch-action: none;
	}

	.custom-cursor {
		position: fixed;
		top: 0;
		left: 0;
		width: 28px;
		height: 28px;
		pointer-events: none;
		z-index: 9999;
		background-size: contain;
		background-repeat: no-repeat;
		background-position: center;
		transform-origin: top left;
		will-change: transform, opacity;
		transition:
			background-image 0.1s ease,
			opacity 0.2s ease;
	}
</style>
