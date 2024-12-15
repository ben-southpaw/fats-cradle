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
	let hasMouseMoved = false;
	let cursorOpacity = 0;

	let lastMouseX = 0;
	let lastMouseY = 0;
	let mouseVelocityX = 0;
	let mouseVelocityY = 0;

	// Configuration for the drawing effect
	const CONFIG = {
		particleSize: 0.3,
		particleDensity: 15,
		lineWidth: 6,
		backgroundColor: '#e8e8e8',
		gridColor: '#d4d4d4',
		hexagonSize: 6,
		particleColor: '#333333',
		preDrawnParticleSize: 1.0, // Increased size for text
		preDrawnDensity: 40, // Higher density for text
		preDrawnColor: '#404040', // Lightened from #2a2a2a
		whiteParticleProbability: 0.3,
	};

	let magnets = [];
	let magnetImages = {};

	// Initialize the canvas and set up event listeners
	onMount(() => {
		if (!canvas) return;
		ctx = canvas.getContext('2d', { willReadFrequently: true });

		// Set cursor styles
		console.log('Cursor URLs:', {
			default: cursorDefault,
			hover: cursorHover,
			click: cursorClick,
		});

		// Set canvas to full screen
		const resize = () => {
			if (!canvas) return;
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
			// Recreate pre-drawn elements after resize
			preDrawnParticles = [];
			createPreDrawnText();
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
				}
			};
		});

		// Register GSAP plugin
		gsap.registerPlugin();

		// Add pre-drawn elements after canvas is initialized
		createPreDrawnText();

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
		if (!canvas) return;
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		gridCache = null; // Clear cache on resize
		drawHexagonGrid();
	};

	// Shared particle creation function
	function createParticle(x, y, isStampParticle = false) {
		const angle = Math.random() * Math.PI * 2;
		return {
			x,
			y,
			angle: angle + ((Math.random() - 0.5) * Math.PI) / 6,
			length: CONFIG.hexagonSize * (0.2 + Math.random() * 0.3),
			width: CONFIG.hexagonSize * 0.05,
			isStampParticle,
			isWhite: Math.random() < CONFIG.whiteParticleProbability,
		};
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
		if (!pendingRender) {
			pendingRender = true;
			animationFrameId = requestAnimationFrame((timestamp) => {
				pendingRender = false;
				renderAll();
				lastRenderTime = timestamp;
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
		const particleDensity = {
			edge: 2,
			fill: 0.9,
		};

		const particleSize = {
			length: CONFIG.hexagonSize * (0.2 + Math.random() * 0.3), // Match drawing particles
			width: CONFIG.hexagonSize * 0.05, // Match drawing particles
			randomness: 0.15,
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
						for (let i = 0; i < particleDensity.edge; i++) {
							points.push({
								x: magnet.x + (x - offsetX) + (Math.random() - 0.5) * 0.8,
								y: magnet.y + (y - offsetY) + (Math.random() - 0.5) * 0.8,
								isEdge: true,
							});
						}
					} else if (Math.random() < particleDensity.fill) {
						points.push({
							x: magnet.x + (x - offsetX) + (Math.random() - 0.5) * 1.5,
							y: magnet.y + (y - offsetY) + (Math.random() - 0.5) * 1.5,
							isEdge: false,
						});
					}
				}
			}
		}

		points.forEach((point) => {
			stampParticles.push(createParticle(point.x, point.y, true));
		});

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
				preDrawnParticles = preDrawnParticles.slice(-(MAX_PARTICLES - particleCount));
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
				});
			}
		}
	}

	function createPreDrawnText() {
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

	// Shared particle rendering function
	function renderParticle(ctx, particle) {
		ctx.fillStyle = particle.color || (particle.isWhite ? '#ffffff' : CONFIG.particleColor);
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

	// Add a function to render everything
	function renderAll() {
		if (!ctx) return; // Guard against undefined ctx
		// Clear and draw background
		ctx.fillStyle = CONFIG.backgroundColor;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Draw hexagon grid
		drawHexagonGrid();

		// Draw all particles in order
		[...stampParticles, ...preDrawnParticles, ...particles].forEach(particle => {
			renderParticle(ctx, particle);
		});

		// Draw magnets last
		renderMagnets();
	}

	function handleMousemove(event) {
		if (!hasMouseMoved) {
			hasMouseMoved = true;
			gsap.to(window, {
				duration: 0.4,
				ease: 'power2.out',
				onUpdate: () => {
					cursorOpacity = gsap.getProperty(window, 'cursorOpacity') || 1;
				},
				cursorOpacity: 1,
			});
		}

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
			// Animate position, rotation, and scale together
			gsap.to(droppedMagnet, {
				x: finalX,
				y: finalY,
				rotation: finalRotation,
				scale: 1.0,
				duration: 0.4,
				ease: 'elastic.out(0.7, 0.5)',
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
</script>

<svelte:window
	on:mousemove={handleMousemove}
	on:mousedown={handleMousedown}
	on:mouseup={handleMouseup}
/>

<div class="canvas-container" bind:this={canvasContainer}>
	<canvas
		bind:this={canvas}
		on:pointerdown={handlePointerDown}
		on:pointermove={handlePointerMove}
		on:pointerup={handlePointerUp}
		on:pointerout={handlePointerUp}
	/>
</div>

<div
	class="custom-cursor"
	bind:this={cursorElement}
	style="
		transform: translate({m.x}px, {m.y}px);
		background-image: url('{(isClicking && isHoveringMagnet)
		? cursorClick
		: isHoveringMagnet
			? cursorHover
			: cursorDefault}');
		opacity: {cursorOpacity};
		position: fixed;
		top: 0;
		left: 0;
		width: 40px;
		height: 40px;
		pointer-events: none;
		z-index: 9999;
		background-size: contain;
		background-repeat: no-repeat;
		background-position: center;
		transform-origin: top left;
		will-change: transform;
		transition: background-image 0.1s ease;
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

	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
