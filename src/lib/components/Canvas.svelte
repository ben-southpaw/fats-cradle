<script>
	import { onMount } from 'svelte';
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
			renderAll();
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
		if (!canvas) return;
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
	const CURSOR_OFFSET_X = 0.62; // Increased X offset
	const CURSOR_OFFSET_Y = 0.42; // Keep Y offset the same

	function getPointerPos(e) {
		const rect = canvas.getBoundingClientRect();
		// Convert rem to pixels using current root font size
		const remToPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
		const offsetXPx = CURSOR_OFFSET_X * remToPx;
		const offsetYPx = CURSOR_OFFSET_Y * remToPx;
		
		return {
			x: e.clientX - rect.left + offsetXPx,
			y: e.clientY - rect.top + offsetYPx
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
				ease: "power3.out",
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
				ease: "power1.out"
			});

			scheduleRender();
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
		if (!magnet || !magnet.img || !magnet.img.complete) return;

		const tempCanvas = document.createElement('canvas');
		const tempCtx = tempCanvas.getContext('2d');

		// Make the temp canvas large enough to handle rotated image
		const maxDimension = Math.ceil(Math.sqrt(magnet.width * magnet.width + magnet.height * magnet.height));
		tempCanvas.width = maxDimension;
		tempCanvas.height = maxDimension;

		// Center and rotate
		tempCtx.save();
		tempCtx.translate(maxDimension / 2, maxDimension / 2);
		tempCtx.rotate((magnet.rotation || 0) * Math.PI / 180);
		tempCtx.drawImage(magnet.img, -magnet.width / 2, -magnet.height / 2, magnet.width, magnet.height);
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
					ctx.rotate((magnet.rotation || 0) * Math.PI / 180);
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
					ctx.rotate((magnet.rotation || 0) * Math.PI / 180);
					ctx.scale(magnet.scale || 1, magnet.scale || 1);
					ctx.translate(-magnet.width / 2, -magnet.height / 2);
					
					ctx.drawImage(
						magnet.img,
						0,
						0,
						magnet.width,
						magnet.height
					);
				}
				
				ctx.restore();
			}
		});
	}

	// Add a function to render everything
	function renderAll() {
		if (!ctx) return; // Guard against undefined ctx
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

	function handleMousemove(event) {
		if (!hasMouseMoved) {
			hasMouseMoved = true;
			gsap.to(window, {
				duration: 0.4,
				ease: "power2.out",
				onUpdate: () => {
					cursorOpacity = gsap.getProperty(window, "cursorOpacity");
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
					bottom: magnet.y + magnet.height + 10
				};
				
				return (
					x >= magnetBounds.left &&
					x <= magnetBounds.right &&
					y >= magnetBounds.top &&
					y <= magnetBounds.bottom
				);
			});
			hoveredMagnet = findClickedMagnet({x, y});
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
			// Scale up animation on pickup
			gsap.to(selectedMagnet, {
				scale: 1.1,
				duration: 0.2,
				ease: "power2.out"
			});
			createMagnetStamp(hoveredMagnet);
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
				ease: "elastic.out(0.7, 0.5)",
				onComplete: () => {
					createMagnetStamp(droppedMagnet);
					scheduleRender();
				}
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

<div
	class="canvas-container"
	bind:this={canvasContainer}
>
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
		background-image: url('{isClicking
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
		width: 100vw;
		height: 100vh;
		overflow: hidden;
	}

	canvas {
		touch-action: none;
		background-color: #e8e8e8;
		width: 100%;
		height: 100%;
	}

	.wiper-container {
		position: fixed;
		bottom: 40px;
		left: 0;
		width: 100%;
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
