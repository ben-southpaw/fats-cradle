<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
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

	const dispatch = createEventDispatcher();

	export let onScreenCanvasReady = () => {};
	export let showScrollToExplore = true;

	let animationFrameId = null;
	let pendingRender = false;
	let lastRenderTime = 0;
	const CONFIG = {
		particleSize: 0.3,
		particleDensity: 8,
		lineWidth: 6,
		backgroundColor: '#e8e8e8',
		gridColor: '#DADADA',
		hexagonSize: 2,
		particleLength: 6,
		particleWidth: 0.3,
		particleColor: '#333333',
		preDrawnParticleSize: 1.0,
		preDrawnDensity: 15,
		preDrawnColor: '#333333',
		whiteParticleProbability: 0.3,
		targetFPS: 60,
		hexagonSpacing: 2 * 3,
		hexagonAvoidanceDistance: 0.5,
		predrawnAvoidanceDistance: 0.4,
		stampAvoidanceDistance: 0.5,
		hexagonLineWidth: 0.5,
		initialStampOpacity: 0.95,
		subsequentStampOpacity: 0.6,
		initialStampDensity: {
			edge: 1.4,
			fill: 1.6,
		},
		subsequentStampDensity: {
			edge: 1.0,
			fill: 0.8,
		},
		maxParticles: 40000,
		particleCullingDistance: 2000,
	};

	const FRAME_INTERVAL = 1000 / CONFIG.targetFPS;
	let lastParticleUpdate = 0;

	// Canvas setup
	let canvas;
	let ctx;
	let shouldDraw = true;
	let particles = [];
	let stampParticles = []; // For magnet stamps
	let preDrawnParticles = []; // For pre-drawn elements
	let drawingPoints = []; // For storing drawing path points
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
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		// Initialize canvas with background
		ctx.fillStyle = CONFIG.backgroundColor;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Notify that canvas is ready
		onScreenCanvasReady(canvas);

		// Start animation loop
		function animate() {
			animationFrameId = requestAnimationFrame(animate);
			const currentTime = performance.now();
			
			if (currentTime - lastRenderTime >= FRAME_INTERVAL) {
				renderAll();
				lastRenderTime = currentTime;
				
				// Keep notifying about canvas updates
				onScreenCanvasReady(canvas);
			}
		}
		animate();

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

		// Clean up
		return () => {
			window.removeEventListener('resize', resize);
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId);
			}
			if (scrollToExploreComponent) {
				scrollToExploreComponent = null;
			}
			if (ctx) {
				ctx = null;
			}
			if (canvas) {
				canvas = null;
			}
		};
	});

	// WebGL setup
	let gl;
	let particleProgram;
	let particleBuffer;
	let particleColorBuffer;

	// WebGL shaders
	const vertexShaderSource = `
		attribute vec2 position;
		attribute vec4 color;
		uniform vec2 resolution;
		varying vec4 vColor;

		void main() {
			vec2 zeroToOne = position / resolution;
			vec2 zeroToTwo = zeroToOne * 2.0;
			vec2 clipSpace = zeroToTwo - 1.0;
			gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
			gl_PointSize = 3.0 * (resolution.y / 1080.0); // Scale with screen height
			vColor = color;
		}
	`;

	const fragmentShaderSource = `
		precision mediump float;
		varying vec4 vColor;

		void main() {
			gl_FragColor = vColor;
		}
	`;

	function createShader(gl, type, source) {
		const shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.error('Shader compile error:', gl.getShaderInfoLog(shader));
			gl.deleteShader(shader);
			return null;
		}
		return shader;
	}

	function renderParticlesWebGL(particles) {
		if (!gl || !particleProgram || particles.length === 0) return;

		const positions = new Float32Array(particles.length * 2);
		const colors = new Float32Array(particles.length * 4);

		particles.forEach((particle, i) => {
			positions[i * 2] = particle.x;
			positions[i * 2 + 1] = particle.y;

			// Convert hex color to RGB
			const color = particle.color.startsWith('#') ? 
				parseInt(particle.color.slice(1), 16) : 
				parseInt(particle.color, 16);
			
			colors[i * 4] = ((color >> 16) & 255) / 255;
			colors[i * 4 + 1] = ((color >> 8) & 255) / 255;
			colors[i * 4 + 2] = (color & 255) / 255;
			colors[i * 4 + 3] = 1.0; // Alpha
		});

		gl.useProgram(particleProgram);

		// Set resolution uniform
		const resolutionLocation = gl.getUniformLocation(particleProgram, 'resolution');
		gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

		// Update position buffer
		const positionLocation = gl.getAttribLocation(particleProgram, 'position');
		gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
		gl.enableVertexAttribArray(positionLocation);
		gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

		// Update color buffer
		const colorLocation = gl.getAttribLocation(particleProgram, 'color');
		gl.bindBuffer(gl.ARRAY_BUFFER, particleColorBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
		gl.enableVertexAttribArray(colorLocation);
		gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

		// Draw particles
		gl.drawArrays(gl.POINTS, 0, particles.length);
	}

	function setupWebGL() {
		if (!canvas) return;

		console.log('Setting up WebGL...');
		
		// Try WebGL2 first
		gl = canvas.getContext('webgl2', { 
			alpha: true,
			premultipliedAlpha: false,
			antialias: false, // Disable antialiasing for better performance
			depth: false, // We don't need depth testing for 2D
			powerPreference: 'high-performance'
		});
		
		if (!gl) {
			console.log('WebGL2 not available, trying WebGL1...');
			gl = canvas.getContext('webgl', {
				alpha: true,
				premultipliedAlpha: false,
				antialias: false,
				depth: false,
				powerPreference: 'high-performance'
			});
		}
		
		if (!gl) {
			console.log('WebGL1 not available, trying experimental-webgl...');
			gl = canvas.getContext('experimental-webgl', {
				alpha: true,
				premultipliedAlpha: false,
				antialias: false,
				depth: false,
				powerPreference: 'high-performance'
			});
		}

		if (!gl) {
			console.warn('WebGL not supported - falling back to Canvas2D');
			return;
		}

		// Log WebGL capabilities
		console.log('WebGL Version:', gl.getParameter(gl.VERSION));
		console.log('WebGL Vendor:', gl.getParameter(gl.VENDOR));
		console.log('WebGL Renderer:', gl.getParameter(gl.RENDERER));
		console.log('Max Texture Size:', gl.getParameter(gl.MAX_TEXTURE_SIZE));
		console.log('Max Viewport Dimensions:', gl.getParameter(gl.MAX_VIEWPORT_DIMS));

		// Enable blending
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		// Create shaders
		const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
		const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

		if (!vertexShader || !fragmentShader) {
			console.error('Failed to create shaders - falling back to Canvas2D rendering');
			gl = null;
			return;
		}

		// Create program
		particleProgram = gl.createProgram();
		gl.attachShader(particleProgram, vertexShader);
		gl.attachShader(particleProgram, fragmentShader);
		gl.linkProgram(particleProgram);

		if (!gl.getProgramParameter(particleProgram, gl.LINK_STATUS)) {
			console.error('Program link error:', gl.getProgramInfoLog(particleProgram));
			gl = null;
			return;
		}

		// Create buffers
		particleBuffer = gl.createBuffer();
		particleColorBuffer = gl.createBuffer();

		// Set viewport
		gl.viewport(0, 0, canvas.width, canvas.height);

		// Test a simple draw call
		gl.useProgram(particleProgram);
		const testPositions = new Float32Array([0, 0]);
		const testColors = new Float32Array([1, 1, 1, 1]);
		
		try {
			const positionLocation = gl.getAttribLocation(particleProgram, 'position');
			const colorLocation = gl.getAttribLocation(particleProgram, 'color');
			const resolutionLocation = gl.getUniformLocation(particleProgram, 'resolution');
			
			gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
			
			gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, testPositions, gl.STATIC_DRAW);
			gl.enableVertexAttribArray(positionLocation);
			gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
			
			gl.bindBuffer(gl.ARRAY_BUFFER, particleColorBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, testColors, gl.STATIC_DRAW);
			gl.enableVertexAttribArray(colorLocation);
			gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);
			
			gl.drawArrays(gl.POINTS, 0, 1);
			
			console.log('WebGL test draw successful');
		} catch (e) {
			console.error('WebGL test draw failed:', e);
			gl = null;
		}
	}

	// Update render function to handle WebGL fallback
	function renderAll() {
		if (!ctx) return;

		const currentTime = performance.now();
		const startTime = currentTime;
		
		// Clear and draw background
		ctx.fillStyle = CONFIG.backgroundColor;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Draw hexagon grid
		drawHexagonGrid();

		// Only update particles at targetFPS rate
		if (currentTime - lastParticleUpdate >= FRAME_INTERVAL) {
			const batchStartTime = performance.now();
			
			perfLogs.particleCount = stampParticles.length + preDrawnParticles.length + particles.length;

			if (gl && gl.isContextLost && !gl.isContextLost()) {
				// Use WebGL rendering
				gl.clear(gl.COLOR_BUFFER_BIT);
				renderParticlesWebGL([...particles, ...preDrawnParticles, ...stampParticles]);
			} else {
				// Fallback to Canvas2D rendering
				stampBatch.clear();
				drawingBatch.clear();
				predrawnBatch.clear();

				// Use separate loops for better performance
				for (const particle of stampParticles) {
					stampBatch.add(particle);
				}

				for (const particle of preDrawnParticles) {
					predrawnBatch.add(particle);
				}

				for (const particle of particles) {
					drawingBatch.add(particle);
				}

				// Render batches
				ctx.save();
				stampBatch.render(ctx);
				predrawnBatch.render(ctx);
				drawingBatch.render(ctx);
				ctx.restore();
			}

			logPerformance('batchTime', performance.now() - batchStartTime);
			lastParticleUpdate = currentTime;
		}

		// Draw magnets last
		if (magnets.length > 0) {
			renderMagnets();
		}

		logPerformance('renderTime', performance.now() - startTime);
	}

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
		if (isTransitioning) return;
		
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
		if (isTransitioning) return;
		
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
		if (isTransitioning) return;
		
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
		if (isTransitioning) return;
		
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

		// Draw image at original size first
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
			this.offscreenCanvas = null;
			this.offscreenCtx = null;
		}

		_initOffscreenCanvas(width, height) {
			if (!this.offscreenCanvas) {
				this.offscreenCanvas = document.createElement('canvas');
			}
			// Only resize if needed
			if (this.offscreenCanvas.width !== width || this.offscreenCanvas.height !== height) {
				this.offscreenCanvas.width = width;
				this.offscreenCanvas.height = height;
				this.offscreenCtx = this.offscreenCanvas.getContext('2d');
				// Match main canvas settings
				this.offscreenCtx.imageSmoothingEnabled = true;
				this.offscreenCtx.imageSmoothingQuality = 'high';
			}
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

		clearToX(x) {
			// Remove particles to the right of x
			for (const [opacity, particles] of this.particles.entries()) {
				this.particles.set(
					opacity,
					particles.filter(p => p.x <= x)
				);
			}
		}

		render(ctx) {
			if (!ctx) return;

			// Initialize or resize offscreen canvas if needed
			this._initOffscreenCanvas(ctx.canvas.width, ctx.canvas.height);
			
			// Clear the offscreen canvas with transparent background
			this.offscreenCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);

			// Group particles by their properties for efficient rendering
			const renderGroups = new Map();

			// Process all particles and group them
			for (const [opacity, particleList] of this.particles.entries()) {
				for (const particle of particleList) {
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

					if (hexCheck.isNear) continue;

					// Create group key based on visual properties
					const color = particle.isWhite ? '#ffffff' : CONFIG.particleColor;
					const finalOpacity = particle.opacity !== undefined ? particle.opacity : opacity;
					const key = `${color}-${finalOpacity}-${particle.isPredrawn}-${particle.isStampParticle}`;

					if (!renderGroups.has(key)) {
						renderGroups.set(key, {
							color,
							opacity: finalOpacity,
							particles: []
						});
					}
					renderGroups.get(key).particles.push(particle);
				}
			}

			// Render each group to offscreen canvas
			for (const group of renderGroups.values()) {
				const { color, opacity, particles } = group;
				if (particles.length === 0) continue;

				this.offscreenCtx.save();
				
				// Set style once for the batch
				const r = parseInt(color.slice(1, 3), 16);
				const g = parseInt(color.slice(3, 5), 16);
				const b = parseInt(color.slice(5, 7), 16);
				this.offscreenCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;

				// Draw all particles in the batch
				for (const particle of particles) {
					this.offscreenCtx.save();
					this.offscreenCtx.translate(particle.x, particle.y);
					this.offscreenCtx.rotate(particle.angle);
					this.offscreenCtx.fillRect(
						-particle.length / 2,
						-particle.width / 2,
						particle.length,
						particle.width
					);
					this.offscreenCtx.restore();
				}

				this.offscreenCtx.restore();
			}

			// Draw the final result to the main canvas
			ctx.drawImage(this.offscreenCanvas, 0, 0);
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

	// Performance monitoring
	const perfLogs = {
		renderTime: [],
		batchTime: [],
		particleCount: 0,
		lastLog: 0,
		LOG_INTERVAL: 5000, // Log every 5 seconds
		RENDER_TIME_THRESHOLD: 50 // Only log if render time exceeds 50ms
	};

	function logPerformance(category, time) {
		perfLogs[category].push(time);
		
		const now = performance.now();
		if (now - perfLogs.lastLog > perfLogs.LOG_INTERVAL) {
			const avgRenderTime = perfLogs.renderTime.reduce((a, b) => a + b, 0) / perfLogs.renderTime.length;
			const avgBatchTime = perfLogs.batchTime.reduce((a, b) => a + b, 0) / perfLogs.batchTime.length;
			
			if (avgRenderTime > perfLogs.RENDER_TIME_THRESHOLD) {
				console.log(`Performance warning: Average render time: ${avgRenderTime.toFixed(2)}ms`);
				if (gl) {
					console.log('Using WebGL rendering');
				} else {
					console.log('Using Canvas2D fallback');
				}
				console.log(`Active particles: ${perfLogs.particleCount}`);
			}
			
			// Clear the logs
			perfLogs.renderTime = [];
			perfLogs.batchTime = [];
			perfLogs.lastLog = now;
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
	let isScrollAnimating = false;
	let isCanvasVisible = true;

	let isTransitioning = false;

	function handleTransitionStart() {
		isTransitioning = true;
		shouldDraw = false;
	}

	function handleSnapBackStart() {
		// Clear all particle arrays
		particles = [];
		stampParticles = [];
		preDrawnParticles = [];
		drawingPoints = [];

		// Clear all batches
		drawingBatch.clear();
		predrawnBatch.clear();
		stampBatch.clear();

		// Reset drawing state
		shouldDraw = false;

		// Force a render to update the canvas
		renderAll();
	}

	function handleTransitionComplete() {
		// Fade out the canvas
		gsap.to(canvas, {
			opacity: 0,
			duration: 0.5,
			ease: "power2.inOut",
			onComplete: () => {
				isCanvasVisible = false;
			}
		});
	}

	function handleWheel(event) {
		if (!hasTriggeredTransition) {
			hasTriggeredTransition = true;
			if (scrollToExploreComponent && !scrollToExploreComponent.hasAnimated) {
				isScrollAnimating = true;
				scrollToExploreComponent.startAnimation().then(() => {
					isScrollAnimating = false;
				});
			}
			if (threeSceneComponent) {
				threeSceneComponent.startTransition();
				dispatch('transitionstart');
			}
		}
	}

	// Progressive clear function
	export function clearWithProgress(progress) {
		if (!canvas) return;
		
		// Calculate x position based on progress (0 to 1)
		const x = canvas.width * (1 - progress);
		removeParticlesAfterX(x);
	}

	// Function to remove particles based on slider position
	function removeParticlesAfterX(x) {
		// Remove particles from arrays
		particles = particles.filter(p => p.x <= x);
		stampParticles = stampParticles.filter(p => p.x <= x);
		preDrawnParticles = preDrawnParticles.filter(p => p.x <= x);

		// Remove particles from batches
		drawingBatch.clearToX(x);
		predrawnBatch.clearToX(x);
		stampBatch.clearToX(x);

		renderAll();
	}

	// Add particle culling
	function cullParticles() {
		const viewCenterX = window.innerWidth / 2;
		const viewCenterY = window.innerHeight / 2;
		const maxDistance = CONFIG.particleCullingDistance;

		// Helper function to check if a particle is too far from view
		function isTooFar(particle) {
			const dx = particle.x - viewCenterX;
			const dy = particle.y - viewCenterY;
			return (dx * dx + dy * dy) > maxDistance * maxDistance;
		}

		// Cull particles that are too far from view
		particles = particles.filter(p => !isTooFar(p));
		stampParticles = stampParticles.filter(p => !isTooFar(p));
		preDrawnParticles = preDrawnParticles.filter(p => !isTooFar(p));
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
		class:hidden={!isCanvasVisible}
		on:pointermove={handlePointerMove}
		on:pointerdown={handlePointerDown}
		on:pointerup={handlePointerUp}
		on:pointerleave={handlePointerLeave}
	></canvas>
	<ThreeScene 
		bind:this={threeSceneComponent} 
		canvas={canvas}
		on:transitionstart={handleTransitionStart}
		on:snapbackstart={handleSnapBackStart}
		on:transitioncomplete={handleTransitionComplete}
	/>
	{#if showScrollToExplore || isScrollAnimating}
		<div class="scroll-indicator">
			<ScrollToExplore bind:this={scrollToExploreComponent} />
		</div>
	{/if}
</div>

<div
	class="cursor"
	bind:this={cursorElement}
	style="transform: translate({m.x}px, {m.y}px); opacity: {cursorOpacity};"
>
	<img src={isClicking && isHoveringMagnet ? cursorClick : isHoveringMagnet ? cursorHover : cursorDefault} alt="cursor" />
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		cursor: none; /* Hide the default cursor */
	}

	.canvas-container {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 1;
	}

	canvas {
		width: 100%;
		height: 100%;
		opacity: 1;
		transition: opacity 0.3s ease;
	}

	canvas.hidden {
		opacity: 0;
		pointer-events: none;
	}

	.cursor {
		position: fixed;
		top: 0;
		left: 0;
		pointer-events: none;
		z-index: 9999;
		width: 32px;
		height: 32px;
		transform-origin: center;
	}

	.cursor img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.scroll-indicator {
		position: fixed;
		top: 40px;
		left: 50%;
		transform: translateX(-50%);
		width: 16vw;
		z-index: 2;
		pointer-events: none;
	}

	.scroll-indicator.hidden {
		opacity: 0;
	}
</style>
