<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { get } from 'svelte/store';
	import { fade, scale } from 'svelte/transition';
	import { gsap } from 'gsap';
	import { isDesktop, isMobile } from '$lib/stores/breakpoint';
	import { appState } from '$lib/stores/appState';

	import { MAGNET_SCALE, MULTI_TEXT_CONFIG } from '$lib/config/scaleConfig';
	import {
		VERTEX_SHADER,
		FRAGMENT_SHADER,
		GRID_VERTEX_SHADER,
		GRID_FRAGMENT_SHADER,
		TEXTURE_VERTEX_SHADER,
		TEXTURE_FRAGMENT_SHADER,
		createShader,
		hexToRGBA,
	} from '$lib/config';
	import letterF from '$lib/images/f.png?url';
	import letterA from '$lib/images/a.png?url';
	import letterT from '$lib/images/t.png?url';
	import letterE from '$lib/images/e.png?url';
	import letterM from '$lib/images/m.png?url';
	import letterA2 from '$lib/images/a2.png?url';
	// import cursorDefault from '$lib/images/cursor.png?url';
	// import cursorHover from '$lib/images/Open.png?url';
	// import cursorClick from '$lib/images/Closed.png?url';
	import multiText from '$lib/images/multi-text.png';
	import ThreeScene from './ThreeScene.svelte';

	// Reactive variable for current breakpoint

	const dispatch = createEventDispatcher();

	// WebGL state management
	let resizeTimeout = null;
	let resizeInterval = null; // Add resizeInterval declaration
	let animationId = null;
	let isContextLost = false;
	let renderer = null;
	let camera = null; // Add camera declaration
	let isRendering = false;
	let isInitialized = false;

	// Variables to track canvas dimensions for repositioning magnets on resize
	let previousCanvasWidth = 0;
	let previousCanvasHeight = 0;

	export let onScreenCanvasReady = () => {};
	// export let showScrollToExplore = true; // Removed as ScrollToExplore is now in +page.svelte
	export let parentDimensions = null;

	// Function to get container dimensions
	function getContainerDimensions() {
		// Use parent dimensions if available
		if (
			parentDimensions &&
			parentDimensions.width > 0 &&
			parentDimensions.height > 0
		) {
			return {
				width: Math.max(1, parentDimensions.width),
				height: Math.max(1, parentDimensions.height),
			};
		}

		// Mobile-specific sizing
		if (get(isMobile)) {
			const width = window.innerWidth;
			const height = window.innerHeight;
			return { width, height };
		}

		// Container-based sizing
		if (canvas) {
			const container = canvas.parentElement;
			if (container) {
				return {
					width: container.clientWidth,
					height: container.clientHeight,
				};
			}
		}

		// Fallback to viewport with aspect ratio
		const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
		const height =
			typeof window !== 'undefined'
				? width * 0.5625 // 16:9 aspect ratio
				: 768;

		return { width, height };
	}

	// Base config values - these are the values for the reference viewport size
	let BASE_CONFIG = {
		// Non-relative properties first so we can reference them
		lineWidth: 12,

		// Sizes relative to lineWidth
		particleSize: 1, // 75% of lineWidth
		particleLength: 1, // 50% of lineWidth
		particleWidth: 1, // 60% of lineWidth

		// Density as particles per lineWidth
		particleDensity: 1.5, // 1 particle per 2 lineWidths

		// Non-relative properties
		backgroundColor: '#f2f2f2',
		gridColor: '#C8C8C8',
		hexagonSize: 3,
		particleColor: '#666666',
		particleOpacity: 1,
		preDrawnParticleSize: 1,
		preDrawnDensity: 0.9,
		preDrawnColor: '#333333',
		multitextDensity: 9.0,
		multitextOpacity: 1,
		multitextWhiteProb: 0,
		cursorWhiteParticleProbability: 0.1,
		stampWhiteParticleProbability: 0.2,
		targetFPS: 60,
		idleFPS: 30,
		idleTimeout: 1000,
		hexagonLineWidth: 0.3,
		initialStampOpacity: 0.9,
		subsequentStampOpacity: 0.65,
		initialStampDensity: {
			edge: 1.4,
			fill: 1.9,
		},
		subsequentStampDensity: {
			edge: 1.2,
			fill: 1.3,
		},
		maxParticles: 40000,
	};

	// Initialize CONFIG with BASE_CONFIG
	let CONFIG = {
		...BASE_CONFIG,
		initialStampDensity: {
			edge: BASE_CONFIG.initialStampDensity.edge,
			fill: BASE_CONFIG.initialStampDensity.fill,
		},
		subsequentStampDensity: {
			edge: BASE_CONFIG.subsequentStampDensity.edge,
			fill: BASE_CONFIG.subsequentStampDensity.fill,
		},
	};

	let animationFrameId = null;
	let pendingRender = false;
	let lastRenderTime = 0;
	let FRAME_INTERVAL = 1000 / CONFIG.targetFPS;
	let lastInteractionTime = performance.now();
	let isIdle = false;

	let saveMultiTextOffsetX;
	let saveMultiTextOffsetY;

	// Pre-computed pattern tables for particle optimization
	const OFFSET_PATTERNS = new Float32Array(16); // Pre-computed offsets

	// Initialize pattern tables
	function initializePatterns() {
		// Create a small set of offset patterns that look natural
		for (let i = 0; i < OFFSET_PATTERNS.length; i++) {
			OFFSET_PATTERNS[i] =
				(i / OFFSET_PATTERNS.length - 0.5) * CONFIG.lineWidth;
		}
	}

	// Deterministic patterns for particle properties
	const PARTICLE_PATTERNS = {
		// 8-directional offset pattern in a circle
		positions: Array.from({ length: 8 }, (_, i) => {
			const angle = (i * Math.PI) / 4;
			return {
				x: Math.cos(angle),
				y: Math.sin(angle),
			};
		}),

		// 6 size variations (0.85 to 1.15)
		sizes: Array.from({ length: 6 }, (_, i) => 0.85 + (0.3 * i) / 5),

		// 8 opacity variations (0.8 to 1.0)
		opacities: Array.from({ length: 8 }, (_, i) => 0.8 + (0.2 * i) / 7),
	};

	// Get deterministic particle properties based on index
	function getParticleProperties(index) {
		const posPattern =
			PARTICLE_PATTERNS.positions[index % PARTICLE_PATTERNS.positions.length];
		const sizePattern =
			PARTICLE_PATTERNS.sizes[index % PARTICLE_PATTERNS.sizes.length];
		const opacityPattern =
			PARTICLE_PATTERNS.opacities[index % PARTICLE_PATTERNS.opacities.length];

		return {
			offset: {
				x: posPattern.x * CONFIG.lineWidth * 0.3,
				y: posPattern.y * CONFIG.lineWidth * 0.3,
			},
			size: CONFIG.particleSize * sizePattern,
			opacity: opacityPattern,
		};
	}

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
	let cursorOpacity = 0; // Start invisible

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

	/**
	 * Repositions and rescales all magnets when the canvas is resized
	 * @param {number} oldWidth - The previous canvas width
	 * @param {number} oldHeight - The previous canvas height
	 * @param {number} newWidth - The new canvas width
	 * @param {number} newHeight - The new canvas height
	 */
	function repositionMagnets(oldWidth, oldHeight, newWidth, newHeight) {
		if (oldWidth <= 0 || oldHeight <= 0 || !magnets || magnets.length === 0) {
			console.log(
				'Skipping magnet repositioning - invalid dimensions or no magnets'
			);
			return; // Avoid division by zero or empty magnets array
		}

		

		// Calculate scale factors for x and y dimensions
		const scaleX = newWidth / oldWidth;
		const scaleY = newHeight / oldHeight;
		
		// Calculate screen width factor for responsive sizing
		const screenWidthFactor = Math.min(1.0, Math.max(0.6, newWidth / 1280));
		const sizeAdjust = Math.min(1.0, Math.max(0.8, newWidth / 1280));
		const adaptiveScale = 1.6 * screenWidthFactor;

		// Reposition and resize each magnet based on the new scale factors
		magnets.forEach((magnet, index) => {
			// Store original values for debugging
			const origX = magnet.x;
			const origY = magnet.y;
			const origWidth = magnet.width;
			const origHeight = magnet.height;

			// Scale positions proportionally
			magnet.x = magnet.x * scaleX;
			magnet.y = magnet.y * scaleY;

			// Store original dimensions the first time for future scaling reference
			if (magnet.originalWidth === undefined) {
				magnet.originalWidth = magnet.width / sizeAdjust;
				magnet.originalHeight = magnet.height / sizeAdjust;
			}
			
			// Recalculate size based on new canvas width using the original dimensions
			// This ensures consistent scaling across multiple resize operations
			magnet.width = magnet.originalWidth * sizeAdjust;
			magnet.height = magnet.originalHeight * sizeAdjust;
			
			// Apply additional scaling for very small screens to prevent overlap
			if (newWidth < 768) {
				const smallScreenAdjust = Math.max(0.6, newWidth / 768);
				magnet.width *= smallScreenAdjust;
				magnet.height *= smallScreenAdjust;
			}

			// Ensure magnets stay within bounds after repositioning
			const bounded = checkCanvasBounds(magnet);
			magnet.x = bounded.x;
			magnet.y = bounded.y;

		
		});

		// Force a render to update visual positions
		scheduleRender();
	}

	function safeResize() {
		try {
			if (!isInitialized) return;

			// Force a reflow to get accurate parent dimensions
			if (canvas) {
				canvas.style.display = 'none';
				void canvas.offsetHeight; // Force reflow
				canvas.style.display = '';
			}

			const { width: canvasWidth, height: canvasHeight } =
				getContainerDimensions();

			// Skip if dimensions are invalid
			if (canvasWidth <= 0 || canvasHeight <= 0 || !canvas) {
				return;
			}

			// Reposition magnets if we have previous dimensions to compare against
			if (
				previousCanvasWidth > 0 &&
				previousCanvasHeight > 0 &&
				(previousCanvasWidth !== canvasWidth ||
					previousCanvasHeight !== canvasHeight)
			) {
				// Only reposition if dimensions actually changed
				repositionMagnets(
					previousCanvasWidth,
					previousCanvasHeight,
					canvasWidth,
					canvasHeight
				);
			}

			// Update canvas element dimensions (crucial for WebGL)
			canvas.width = canvasWidth;
			canvas.height = canvasHeight;

			// Also set CSS dimensions explicitly
			canvas.style.width = `${canvasWidth}px`;
			canvas.style.height = `${canvasHeight}px`;

			// Update WebGL viewport
			if (gl) {
				gl.viewport(0, 0, canvasWidth, canvasHeight);
			}

			// Update any render targets or textures if needed
			if (renderer?.setSize) {
				renderer.setSize(canvasWidth, canvasHeight, false);
			}

			// Update camera if it exists and has required properties
			if (camera && typeof camera.aspect !== 'undefined') {
				try {
					camera.aspect = canvasWidth / canvasHeight;
					if (typeof camera.updateProjectionMatrix === 'function') {
						camera.updateProjectionMatrix();
					}
				} catch (cameraError) {
					console.warn('Error updating camera:', cameraError);
				}
			}

			// Store current dimensions for next resize
			previousCanvasWidth = canvasWidth;
			previousCanvasHeight = canvasHeight;

			// Force a render to update visuals immediately
			scheduleRender();
		} catch (error) {
			console.warn('Error during resize:', error);
		}
	}

	// Debounced resize handler
	function handleResize() {
		clearTimeout(resizeTimeout);
		// Perform an immediate resize for better responsiveness
		if (canvas) {
			// Apply critical CSS size updates immediately
			const { width, height } = getContainerDimensions();
			if (width > 0 && height > 0) {
				canvas.style.width = `${width}px`;
				canvas.style.height = `${height}px`;
			}
		}
		// Then do full resize with a short delay to prevent thrashing
		resizeTimeout = setTimeout(safeResize, 30);
	}

	function safeRender() {
		try {
			if (!renderer || !scene || !camera) return;
			renderer.render(scene, camera);
		} catch (error) {
			// Only log if we have a renderer (prevents errors during cleanup)
			if (renderer) {
				console.warn('Error during render:', error);
			}
		}
	}

	function animate(timestamp) {
		if (!isRendering) return;

		animationId = requestAnimationFrame(animate);

		// Only render if we have a valid renderer and scene
		if (renderer && scene && camera) {
			const currentTime = performance.now();

			// Check if we should switch to idle FPS
			if (!isIdle && currentTime - lastInteractionTime > CONFIG.idleTimeout) {
				isIdle = true;
				FRAME_INTERVAL = 1000 / CONFIG.idleFPS;
			}

			if (currentTime - lastRenderTime >= FRAME_INTERVAL) {
				safeRender();
				lastRenderTime = currentTime;
			}
		}
	}

	function handleContextLost(event) {
		event.preventDefault();
		isContextLost = true;
		console.warn('WebGL context lost, waiting for restoration...');

		// Try to restore the context after a short delay
		setTimeout(() => {
			if (canvas?.getContext) {
				const newGl =
					canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
				if (newGl) {
					gl = newGl;
					isContextLost = false;
					setupWebGL();
					animate();
				}
			}
		}, 100);
	}

	function initializeWebGL() {
		try {
			setupWebGL();
			if (!isContextLost) {
				animate();
			}
			isInitialized = true;
		} catch (error) {
			console.error('Failed to initialize WebGL:', error);
		}
	}

	// Initial resize and render
	function resize() {
		// Skip if not in desktop mode
		if (!get(isDesktop)) {
			isCanvasVisible = false;
			return;
		}

		isCanvasVisible = true;
		if (!isInitialized) {
			initializeWebGL();
		}
		handleResize();
	}

	let hasTriggeredTransition = false;

	onMount(() => {
		// Set up window resize handler
		window.addEventListener('resize', handleResize);

		// Set up context loss handler
		if (canvas) {
			canvas.addEventListener('webglcontextlost', handleContextLost, false);
		}

		// Initial setup and resize
		resize();

		if (!get(isDesktop)) {
			isCanvasVisible = false;
			return;
		}

		if (!canvas) return;

		// Initialize patterns
		initializePatterns();

		// Setup canvas and WebGL
		setupWebGL();

		// Set up deviceInfo subscription for responsive behavior
		const unsubscribeIsMobile = isMobile.subscribe((mobile) => {
			isMobileMode = mobile;

			// Resize canvas on breakpoint changes
			resize(); // Use the correct function name
		});

		// Subscribe to appState for transitions
		const unsubscribeAppState = appState.subscribe(($appState) => {
			// When auto-transition is triggered in the store
			if ($appState.autoTransitionTriggered && !hasTriggeredTransition) {
				setTimeout(() => {
					handleWheel({ deltaY: 100, preventDefault: () => {} });
					hasTriggeredTransition = true;
				}, 100); // Reduced timeout since we're already waiting in the store
			}
		});

		// Initial device check
		isMobileMode = get(isMobile);

		// For mobile/tablet, directly trigger auto-transition
		// Use direct approach for now to ensure functionality works
		if (isMobileMode && !hasTriggeredTransition) {
			setTimeout(() => {
				// Direct method to ensure transition works while we refactor
				handleWheel({ deltaY: 100, preventDefault: () => {} });
				hasTriggeredTransition = true;

				// Also update appState for future integration
				try {
					// Only update appState if it's working
					appState.set({ autoTransitionTriggered: true });
				} catch (error) {
					console.warn(
						'Error updating appState, continuing with direct transition',
						error
					);
				}
			}, 1000); // Wait a second before triggering
		}

		// Clean up subscriptions on component destroy
		onDestroy(() => {
			// Stop the render loop
			isRendering = false;
			if (animationId) {
				cancelAnimationFrame(animationId);
				animationId = null;
			}

			// Clean up renderer
			if (renderer) {
				try {
					renderer.forceContextLoss?.();
					renderer.dispose?.();
					renderer.domElement?.remove?.();
					renderer = null;
				} catch (error) {
					console.warn('Error during renderer cleanup:', error);
				}
			}

			// Clean up WebGL context
			if (gl) {
				try {
					const loseContext = gl.getExtension('WEBGL_lose_context');
					if (loseContext) {
						loseContext.loseContext();
					}
				} catch (error) {
					console.warn('Error during WebGL context cleanup:', error);
				} finally {
					gl = null;
				}
			}

			// Clean up canvas
			if (canvas) {
				try {
					canvas.width = 1;
					canvas.height = 1;
				} catch (error) {
					console.warn('Error during canvas cleanup:', error);
				}
			}

			// Clear other references
			scene = null;
			camera = null;

			// Unsubscribe from stores
			if (unsubscribeIsMobile) unsubscribeIsMobile();
			if (unsubscribeAppState) unsubscribeAppState();

			// Remove event listeners
			window.removeEventListener('resize', handleResize);
			if (canvas) {
				try {
					canvas.removeEventListener(
						'webglcontextlost',
						handleContextLost,
						false
					);
				} catch (error) {
					console.warn('Error removing event listeners:', error);
				}
			}
		});

		// Fallback to 2D context if WebGL setup failed
		if (!gl) {
			ctx = canvas.getContext('2d');
		}

		// Initialize canvas with background
		if (ctx) {
			ctx.fillStyle = CONFIG.backgroundColor;
			ctx.fillRect(0, 0, canvas.width, canvas.height);
		} else if (gl) {
			gl.clearColor(
				parseInt(CONFIG.backgroundColor.slice(1, 3), 16) / 255,
				parseInt(CONFIG.backgroundColor.slice(3, 5), 16) / 255,
				parseInt(CONFIG.backgroundColor.slice(5, 7), 16) / 255,
				1.0
			);
			gl.clear(gl.COLOR_BUFFER_BIT);
		}

		// Notify that canvas is ready
		onScreenCanvasReady(canvas);

		// Start animation loop
		function animate() {
			animationFrameId = requestAnimationFrame(animate);
			//TODO
			//if (mobile ) return
			const currentTime = performance.now();

			// Check if we should switch to idle FPS
			if (!isIdle && currentTime - lastInteractionTime > CONFIG.idleTimeout) {
				isIdle = true;
				FRAME_INTERVAL = 1000 / CONFIG.idleFPS;
			}

			if (currentTime - lastRenderTime >= FRAME_INTERVAL) {
				renderAll();
				lastRenderTime = currentTime;

				// Keep notifying about canvas updates
				onScreenCanvasReady(canvas);
			}
		}
		animate();

		// Create and load all letter images
		const letterSources = {
			F: letterF,
			A: letterA,
			T: letterT,
			E: letterE,
			M: letterM,
			A2: letterA2,
		};

		let loadedCount = 0;
		const totalImages = Object.keys(letterSources).length;

		Object.entries(letterSources).forEach(([letter, src]) => {
			const img = new Image();
			img.onload = () => {
				magnetImages[letter] = img;
				if (gl && textureProgram) {
					loadTexture(src).then((texture) => {
						magnetTextures.set(letter, texture);
						loadedCount++;
						if (loadedCount === totalImages) {
							initializeMagnets();
							// Create pre-drawn elements only after all images are loaded
							createPreDrawnElements(magnets[0]);
						}
					});
				}
			};
			img.src = src;
		});

		// Register GSAP plugin
		gsap.registerPlugin();

		// Clean up
		return () => {
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId);
			}
			if (scrollToExploreComponent) {
				scrollToExploreComponent = null;
			}
			if (ctx) {
				ctx = null;
			}
			if (gl) {
				gl.deleteProgram(particleProgram);
				gl.deleteBuffer(particleBuffer);
				gl.deleteBuffer(particleColorBuffer);
				gl = null;
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
	let gridProgram;
	let gridBuffer;
	let textureProgram;
	let textureBuffer;
	let texCoordBuffer;
	// let letterTexture;

	// WebGL shaders
	// Using vertexShaderSource from centralized config as VERTEX_SHADER

	// Using fragmentShaderSource from centralized config as FRAGMENT_SHADER

	// Using gridVertexShaderSource from centralized config as GRID_VERTEX_SHADER

	// Using gridFragmentShaderSource from centralized config as GRID_FRAGMENT_SHADER

	// Using textureVertexShaderSource from centralized config as TEXTURE_VERTEX_SHADER

	// Using textureFragmentShaderSource from centralized config as TEXTURE_FRAGMENT_SHADER

	// Using createShader and hexToRGBA from centralized config

	// Helper function to prepare particle data for WebGL
	function prepareParticleData(particles) {
		const positions = new Float32Array(particles.length * 2);
		const colors = new Float32Array(particles.length * 4);

		particles.forEach((particle, i) => {
			const posIndex = i * 2;
			const colorIndex = i * 4;

			// Position
			positions[posIndex] = particle.x;
			positions[posIndex + 1] = particle.y;

			// Color
			const rgba = hexToRGBA(
				particle.color || CONFIG.particleColor,
				particle.opacity || 1
			);
			colors[colorIndex] = rgba[0];
			colors[colorIndex + 1] = rgba[1];
			colors[colorIndex + 2] = rgba[2];
			colors[colorIndex + 3] = rgba[3];
		});

		return { positions, colors };
	}

	// WebGL particle rendering function
	function renderParticlesWebGL(particles) {
		if (!gl || !particleProgram || particles.length === 0) {
			return;
		}

		// Use shader program
		gl.useProgram(particleProgram);

		// Update resolution uniform
		const resolutionLocation = gl.getUniformLocation(
			particleProgram,
			'resolution'
		);
		gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

		// Update hex size uniform
		const hexSizeLocation = gl.getUniformLocation(particleProgram, 'hexSize');
		gl.uniform1f(hexSizeLocation, CONFIG.hexagonSize);

		// Prepare data
		const { positions, colors } = prepareParticleData(particles);

		// Update position buffer
		gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
		const positionLocation = gl.getAttribLocation(particleProgram, 'position');
		gl.enableVertexAttribArray(positionLocation);
		gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

		// Update color buffer
		gl.bindBuffer(gl.ARRAY_BUFFER, particleColorBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);
		const colorLocation = gl.getAttribLocation(particleProgram, 'color');
		gl.enableVertexAttribArray(colorLocation);
		gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

		// Enable blending for smooth particle overlap
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		// Draw particles
		gl.drawArrays(gl.POINTS, 0, particles.length);
	}

	// WebGL grid rendering function
	function renderGridWebGL() {
		if (!gl || !gridProgram) return;

		// Use shader program
		gl.useProgram(gridProgram);

		// Update resolution uniform
		const resolutionLocation = gl.getUniformLocation(gridProgram, 'resolution');
		gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

		// Update grid color uniform
		const gridColorLocation = gl.getUniformLocation(gridProgram, 'gridColor');
		const gridRGBA = hexToRGBA(CONFIG.gridColor);
		gl.uniform4f(
			gridColorLocation,
			gridRGBA[0],
			gridRGBA[1],
			gridRGBA[2],
			gridRGBA[3]
		);

		// Update and bind grid vertices
		const vertices = prepareGridVertices();
		gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

		// Set up vertex attributes
		const positionLocation = gl.getAttribLocation(gridProgram, 'position');
		gl.enableVertexAttribArray(positionLocation);
		gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

		// Set line width
		gl.lineWidth(CONFIG.hexagonLineWidth);

		// Draw grid lines
		gl.drawArrays(gl.LINES, 0, vertices.length / 2);
	}

	// WebGL texture rendering function
	function renderTexture(texture, x, y, width, height) {
		if (!gl || !textureProgram || !texture) return;

		// Use shader program
		gl.useProgram(textureProgram);

		// Set up vertex positions for the quad
		const positions = new Float32Array([
			x,
			y,
			x + width,
			y,
			x,
			y + height,
			x,
			y + height,
			x + width,
			y,
			x + width,
			y + height,
		]);

		gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

		// Set up attributes and uniforms
		const positionLoc = gl.getAttribLocation(textureProgram, 'position');
		const texCoordLoc = gl.getAttribLocation(textureProgram, 'texCoord');
		const resolutionLoc = gl.getUniformLocation(textureProgram, 'resolution');

		gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
		gl.enableVertexAttribArray(positionLoc);
		gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
		gl.enableVertexAttribArray(texCoordLoc);
		gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

		gl.uniform2f(resolutionLoc, gl.canvas.width, gl.canvas.height);

		// Bind the texture and draw
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.drawArrays(gl.TRIANGLES, 0, 6);

		// Enable blending for transparency
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	}

	// Helper function to prepare grid vertices
	function prepareGridVertices() {
		const size = CONFIG.hexagonSize * 3;
		const hexWidth = size * 2; // Width of a hexagon
		const hexHeight = size * Math.sqrt(3); // Height of a hexagon
		const vertices = [];

		// Calculate grid dimensions with proper spacing
		const horizontalSpacing = hexWidth * 0.75; // Overlap horizontally by 1/4 of width
		const verticalSpacing = hexHeight;
		const cols = Math.ceil(canvas.width / horizontalSpacing) + 1;
		const rows = Math.ceil(canvas.height / verticalSpacing) + 1;

		// Generate vertices for each hexagon
		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				// Calculate center of each hexagon
				const centerX = col * horizontalSpacing;
				const centerY =
					row * verticalSpacing + (col % 2) * (verticalSpacing / 2);

				// Generate vertices for hexagon
				for (let i = 0; i < 6; i++) {
					// Calculate current vertex
					const angle = (i * Math.PI) / 3;
					const px = centerX + size * Math.cos(angle);
					const py = centerY + size * Math.sin(angle);
					vertices.push(px, py);

					// Calculate next vertex to create line
					const nextAngle = (((i + 1) % 6) * Math.PI) / 3;
					const nextX = centerX + size * Math.cos(nextAngle);
					const nextY = centerY + size * Math.sin(nextAngle);
					vertices.push(nextX, nextY);
				}
			}
		}

		return new Float32Array(vertices);
	}

	// Texture buffers and data
	let letterTexture;

	function createTextureShaderProgram() {
		const vertexShader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vertexShader, TEXTURE_VERTEX_SHADER);
		gl.compileShader(vertexShader);

		const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fragmentShader, TEXTURE_FRAGMENT_SHADER);
		gl.compileShader(fragmentShader);

		textureProgram = gl.createProgram();
		gl.attachShader(textureProgram, vertexShader);
		gl.attachShader(textureProgram, fragmentShader);
		gl.linkProgram(textureProgram);

		if (!gl.getProgramParameter(textureProgram, gl.LINK_STATUS)) {
			return null;
		}

		return textureProgram;
	}

	function loadTexture(url) {
		return new Promise((resolve) => {
			const texture = gl.createTexture();
			const image = new Image();
			image.onload = () => {
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.texImage2D(
					gl.TEXTURE_2D,
					0,
					gl.RGBA,
					gl.RGBA,
					gl.UNSIGNED_BYTE,
					image
				);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
				resolve(texture);
			};
			image.src = url;
		});
	}

	function setupTextureBuffers() {
		// Create buffers for the texture quad
		textureBuffer = gl.createBuffer();
		texCoordBuffer = gl.createBuffer();

		// Set up the texture coordinates
		const texCoords = new Float32Array([
			0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0,
		]);

		gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
	}

	function setupWebGL() {
		if (!canvas) {
			return;
		}

		// Get container dimensions - use parent dimensions if available
		const { width, height } = getContainerDimensions();
		// Set canvas size to match container
		canvas.width = width;
		canvas.height = height;

		// Try WebGL2 first
		try {
			gl = canvas.getContext('webgl2', {
				alpha: true,
				premultipliedAlpha: false,
				antialias: false,
				depth: false,
				powerPreference: 'high-performance',
			});

			if (gl) {
				gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
			}
		} catch (e) {}

		// Fallback to WebGL1
		if (!gl) {
			try {
				gl = canvas.getContext('webgl', {
					alpha: true,
					premultipliedAlpha: false,
					antialias: false,
					depth: false,
					powerPreference: 'high-performance',
				});
				if (gl) {
					gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
				}

				if (gl) {
				}
			} catch (e) {}
		}

		// Final fallback to experimental-webgl
		if (!gl) {
			try {
				gl = canvas.getContext('experimental-webgl', {
					alpha: true,
					premultipliedAlpha: false,
					antialias: false,
					depth: false,
					powerPreference: 'high-performance',
				});

				if (gl) {
				}
			} catch (e) {}
		}

		if (!gl) {
			return;
		}

		// Create shaders using centralized shader code
		const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
		const fragmentShader = createShader(
			gl,
			gl.FRAGMENT_SHADER,
			FRAGMENT_SHADER
		);
		const gridVertexShader = createShader(
			gl,
			gl.VERTEX_SHADER,
			GRID_VERTEX_SHADER
		);
		const gridFragmentShader = createShader(
			gl,
			gl.FRAGMENT_SHADER,
			GRID_FRAGMENT_SHADER
		);
		const textureVertexShader = createShader(
			gl,
			gl.VERTEX_SHADER,
			TEXTURE_VERTEX_SHADER
		);
		const textureFragmentShader = createShader(
			gl,
			gl.FRAGMENT_SHADER,
			TEXTURE_FRAGMENT_SHADER
		);

		if (
			!vertexShader ||
			!fragmentShader ||
			!gridVertexShader ||
			!gridFragmentShader ||
			!textureVertexShader ||
			!textureFragmentShader
		) {
			gl = null;
			return;
		}

		// Create program with logging
		particleProgram = gl.createProgram();
		gl.attachShader(particleProgram, vertexShader);
		gl.attachShader(particleProgram, fragmentShader);
		gl.linkProgram(particleProgram);

		if (!gl.getProgramParameter(particleProgram, gl.LINK_STATUS)) {
			gl = null;
			return;
		}

		// Create grid program with logging
		gridProgram = gl.createProgram();
		gl.attachShader(gridProgram, gridVertexShader);
		gl.attachShader(gridProgram, gridFragmentShader);
		gl.linkProgram(gridProgram);

		if (!gl.getProgramParameter(gridProgram, gl.LINK_STATUS)) {
			gl = null;
			return;
		}

		// Create texture program with logging
		textureProgram = createTextureShaderProgram();

		// Create buffers with logging
		particleBuffer = gl.createBuffer();
		particleColorBuffer = gl.createBuffer();
		gridBuffer = gl.createBuffer();
		textureBuffer = gl.createBuffer();
		texCoordBuffer = gl.createBuffer();
		if (
			!particleBuffer ||
			!particleColorBuffer ||
			!gridBuffer ||
			!textureBuffer ||
			!texCoordBuffer
		) {
			gl = null;
			return;
		}

		// Set viewport
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

		// Test draw
		gl.useProgram(particleProgram);
		const testPositions = new Float32Array([0, 0]);
		const testColors = new Float32Array([1, 1, 1, 1]);

		const positionLocation = gl.getAttribLocation(particleProgram, 'position');
		const colorLocation = gl.getAttribLocation(particleProgram, 'color');
		const resolutionLocation = gl.getUniformLocation(
			particleProgram,
			'resolution'
		);

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

		// Check for errors after draw
		const error = gl.getError();
		if (error === gl.NO_ERROR) {
		} else {
			gl = null;
		}

		// Load the letter F texture
		loadTexture(letterF).then((texture) => {
			letterTexture = texture;
			scheduleRender();
		});

		// Set up texture buffers
		setupTextureBuffers();
	}

	// Update render function to handle WebGL fallback
	function renderAll() {
		if (!gl) return;

		// Clear the canvas
		gl.clear(gl.COLOR_BUFFER_BIT);

		// Render the grid and particles
		renderGridWebGL();
		renderParticlesWebGL([
			...particles,
			...preDrawnParticles,
			...stampParticles,
		]);

		// // Draw all magnets
		drawMagnets();
	}

	// Magnet textures
	let magnetTextures = new Map();

	// // Map letters to their image URLs
	// const letterImages = {
	// 	F: letterF,
	// 	A: letterA,
	// 	T: letterT,
	// 	E: letterE,
	// 	M: letterM,
	// 	A2: letterA2,
	// };

	function drawMagnets() {
		if (!gl || !textureProgram) {
			return;
		}

		// Draw each magnet
		for (const magnet of magnets) {
			const letter = magnet.id; // The id is the letter type (F, A, T, etc.)
			const texture = magnetTextures.get(letter);
			if (!texture) {
				continue;
			}

			// Calculate magnet position and size
			const width = magnet.width || CONFIG.magnetSize || 100;
			const height = magnet.height || CONFIG.magnetSize || 100;
			const x = magnet.x - width / 2;
			const y = magnet.y - height / 2;

			// Apply any rotation or transformations
			gl.useProgram(textureProgram);

			// Create transformation matrix for rotation
			const centerX = x + width / 2;
			const centerY = y + height / 2;
			const rotation = magnet.rotation || 0;

			// Update vertex positions to include rotation
			const positions = new Float32Array([
				...rotatePoint(x, y, centerX, centerY, rotation),
				...rotatePoint(x + width, y, centerX, centerY, rotation),
				...rotatePoint(x, y + height, centerX, centerY, rotation),
				...rotatePoint(x, y + height, centerX, centerY, rotation),
				...rotatePoint(x + width, y, centerX, centerY, rotation),
				...rotatePoint(x + width, y + height, centerX, centerY, rotation),
			]);

			gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

			// Set up attributes and uniforms
			const positionLoc = gl.getAttribLocation(textureProgram, 'position');
			const texCoordLoc = gl.getAttribLocation(textureProgram, 'texCoord');
			const resolutionLoc = gl.getUniformLocation(textureProgram, 'resolution');

			gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
			gl.enableVertexAttribArray(positionLoc);
			gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

			gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
			gl.enableVertexAttribArray(texCoordLoc);
			gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

			gl.uniform2f(resolutionLoc, gl.canvas.width, gl.canvas.height);

			// Enable blending for transparency
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

			// Bind the texture and draw
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
		}
	}

	// Helper function to rotate a point around a center
	function rotatePoint(x, y, centerX, centerY, angleInDegrees) {
		const angleInRadians = (angleInDegrees * Math.PI) / 180;
		const cos = Math.cos(angleInRadians);
		const sin = Math.sin(angleInRadians);

		// Translate point to origin
		const dx = x - centerX;
		const dy = y - centerY;

		// Rotate point
		const rotatedX = dx * cos - dy * sin + centerX;
		const rotatedY = dx * sin + dy * cos + centerY;

		return [rotatedX, rotatedY];
	}

	// Shared particle creation function
	function createParticle(x, y, isStamp = false, isPredrawn = false) {
		let finalX = x;
		let finalY = y;

		// Add more random offset to break up line patterns
		const offsetScale = CONFIG.lineWidth * 0.25; // 25% of lineWidth
		finalX += (Math.random() - 0.5) * offsetScale;
		finalY += (Math.random() - 0.5) * offsetScale;

		// Occasionally add larger jumps to create gaps
		if (Math.random() < 0.2) {
			finalX += (Math.random() - 0.5) * offsetScale * 2;
			finalY += (Math.random() - 0.5) * offsetScale * 2;
		}

		return {
			x: finalX,
			y: finalY,
			angle: Math.random() * Math.PI * 2,
			length: CONFIG.particleLength,
			width: CONFIG.particleWidth,
			isStampParticle: isStamp,
			isPredrawn,
			opacity: isStamp
				? isPredrawn
					? CONFIG.multitextOpacity
					: CONFIG.subsequentStampOpacity
				: CONFIG.particleOpacity,
			color:
				!isStamp && Math.random() < CONFIG.cursorWhiteParticleProbability
					? '#ffffff'
					: CONFIG.particleColor,
		};
	}

	// Generate magnetic particles along the line
	const MAX_PARTICLES = 800000; // Adjust based on needs
	function generateParticles(x1, y1, x2, y2) {
		const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
		// Use parent dimensions if available
		const { width, height } = getContainerDimensions();

		// Scale up density for short distances
		const DENSITY_SCALE = 10; // Ensure at least 1 particle per 10 pixels
		const count = Math.min(
			Math.max(
				1,
				Math.floor(distance * CONFIG.particleDensity * DENSITY_SCALE)
			),
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

			// Calculate angle (perpendicular to drawing direction)
			const angle = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;

			// Use pattern table instead of random
			const patternIndex = (i + Math.floor(x + y)) % OFFSET_PATTERNS.length;
			const offset = OFFSET_PATTERNS[patternIndex];

			const perpX = Math.cos(angle) * offset;
			const perpY = Math.sin(angle) * offset;

			particles.push(createParticle(x + perpX, y + perpY));
		}
	}

	function getPointerPos(e) {
		// Get canvas position within the page
		const rect = canvas.getBoundingClientRect();

		// Get exact dimensions from the actual elements
		const displayWidth = rect.width;
		const displayHeight = rect.height;
		const renderWidth = canvas.width;
		const renderHeight = canvas.height;

		// Calculate actual scaling factors in case they've changed
		const actualScaleX = renderWidth / displayWidth;
		const actualScaleY = renderHeight / displayHeight;

		// Calculate coordinates relative to the canvas display position
		const relX = e.clientX - rect.left;
		const relY = e.clientY - rect.top;

		// Apply dynamically calculated scaling for precise mapping
		const x = relX * actualScaleX;
		const y = relY * actualScaleY;

		// Store both the raw display coordinates and the internal rendering coordinates
		// We'll use rawCoords for visual cursor positioning and x,y for internal logic
		e.rawCoords = { x: relX, y: relY };

		// Return the properly scaled coordinates
		return { x, y };
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

			lastMouseX = x;
			lastMouseY = y;
			mouseVelocityX = 0;
			mouseVelocityY = 0;
		} else {
			shouldDraw = false;
		}
	}

	function handlePointerUp(e) {
		if (isTransitioning) return;

		if (isDraggingMagnet && selectedMagnet) {
			const droppedMagnet = selectedMagnet;
			isDraggingMagnet = false;

			// Reset cursor based on whether still hovering over a magnet
			if (isHoveringMagnet) {
				document.body.style.cursor = 'grab';
			} else {
				document.body.style.cursor = 'default';
			}
			const finalRotation = Math.round(droppedMagnet.rotation / 5) * 5;

			// Check canvas bounds and get corrected position
			const boundedPosition = checkCanvasBounds(droppedMagnet);

			// Update magnet position with bounded position
			droppedMagnet.x = boundedPosition.x;
			droppedMagnet.y = boundedPosition.y;

			// Check for collisions with other magnets
			const otherMagnets = magnets.filter((m) => m !== droppedMagnet);
			let collidingMagnet = null;

			// Find the magnet that's being collided with
			for (const other of otherMagnets) {
				if (checkCollision(droppedMagnet, other)) {
					collidingMagnet = other;
					break;
				}
			}

			// If collision detected, move the magnet that's already on the canvas
			if (collidingMagnet) {
				// Find free space for the colliding magnet (the one already on the canvas)
				const magnetsExceptColliding = magnets.filter(
					(m) => m !== collidingMagnet
				);
				const freePosition = findFreeSpace(
					collidingMagnet,
					magnetsExceptColliding
				);

				// If a free space was found, move to it, otherwise use a simple offset
				const newPosition = freePosition || {
					x: collidingMagnet.x + 30, // Simple horizontal offset if no free space
					y: collidingMagnet.y - 20,
				};

				// Animate the colliding magnet to the new position
				gsap.to(collidingMagnet, {
					x: newPosition.x,
					y: newPosition.y,
					duration: 0.3,
					ease: 'power2.out',
					onUpdate: () => scheduleRender(),
					onComplete: () => {
						// Create stamp for the moved magnet at its new position
						createMagnetStamp(collidingMagnet);
					},
				});
			}

			gsap.killTweensOf(droppedMagnet);
			gsap.to(droppedMagnet, {
				x: boundedPosition.x,
				y: boundedPosition.y,
				scale: 1,
				rotation: finalRotation,
				duration: 0.3,
				ease: 'power2.out',
				onUpdate: () => scheduleRender(),
				onComplete: () => {
					droppedMagnet.isPickedUp = false;
					// Create stamp after animation completes with final position
					createMagnetStamp(droppedMagnet);
					restoreMagnetPosition(droppedMagnet, selectedMagnetIndex);
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
			selectedMagnet.x = pos.x + selectedMagnet.grabOffsetX;
			selectedMagnet.y = pos.y + selectedMagnet.grabOffsetY;

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
			const width = magnet.width * scale;
			const height = magnet.height * scale;

			// Calculate the actual render position (centered)
			const x = magnet.x - width / 2;
			const y = magnet.y - height / 2;

			// Add minimal padding for hover detection
			const padding = 5;
			return (
				pos.x >= x - padding &&
				pos.x <= x + width + padding &&
				pos.y >= y - padding &&
				pos.y <= y + height + padding
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

		// Define particle size properties
		const particleSize = {
			length: CONFIG.particleLength * (0.8 + Math.random() * 0.4), // Maintain 80-120% of length
			width: CONFIG.particleWidth * (0.9 + Math.random() * 0.2), // Maintain 90-110% of width
			randomness: 0.15,
		};

		// Calculate offset to center the stamp particles around the magnet's position
		let offsetX = magnet?.width ? magnet.width / 2 : magnet.img.width / 2;
		let offsetY = magnet?.height ? magnet.height / 2 : magnet.img.height / 2;

		if (tempCanvas) {
			offsetX = (tempCanvas.width - (magnet?.width || magnet.img.width)) / 2;
			offsetY = (tempCanvas.height - (magnet?.height || magnet.img.height)) / 2;
		}

		// Add specific offsets for multi-text image
		let isMultiText = magnet.img.src.includes('multi-text');
		// Use container dimensions for responsive layout
		const { width, height } = getContainerDimensions();
		const multiTextOffsetX = isMultiText ? width * 0.36 : 0; // Half screen minus 15% plus 8vw
		const multiTextOffsetY = isMultiText ? height * 0.65 : 0; // 230px (reduced from 300) minus 15% of height

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
				const i = (y * tempCanvas.width + x) * 4;
				const alpha = data[i + 3];

				if (alpha > alphaThreshold) {
					const leftAlpha = data[i - 4 + 3];
					const rightAlpha = data[i + 4 + 3];
					const topAlpha = data[i - tempCanvas.width * 4 + 3];
					const bottomAlpha = data[i + tempCanvas.width * 4 + 3];

					const isEdge =
						leftAlpha <= alphaThreshold ||
						rightAlpha <= alphaThreshold ||
						topAlpha <= alphaThreshold ||
						bottomAlpha <= alphaThreshold;

					const newX =
						magnet.x -
						(magnet?.width || magnet.img.width) / 2 +
						(x - offsetX) +
						multiTextOffsetX;
					const newY =
						magnet.y -
						(magnet?.height || magnet.img.height) / 2 +
						(y - offsetY) +
						multiTextOffsetY;

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
		// Define height ranges for different letter groups - adjusted to be more centered
		const heights = {
			high: { base: 0.4, variance: 0.01 }, // 40-41vh from top
			middle: { base: 0.45, variance: 0.01 }, // 45-46vh from top
			low: { base: 0.5, variance: 0.01 }, // 50-51vh from top
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
				return heights.middle.base;
		}
	}

	function getLetterOffset(letter) {
		// Add specific offsets for F and A
		// Use parent dimensions if available for responsive layout
		const containerDims = getContainerDimensions();

		switch (letter) {
			case 'F':
				return containerDims.width * 0.03; // Move F right by 3vw
			case 'A':
				return containerDims.width * 0.01; // Move A right by 1vw
			case 'A2':
				return containerDims.width * 0.01; // Move A right by 1vw
			default:
				return 0;
		}
	}

	function initializeMagnets() {
		if (!magnetImages) return;

		// Use parent dimensions for responsive layout
		const { width } = getContainerDimensions();

		// Calculate base scale based on container width for responsive sizing
		let scale = width / 1920;

		const letters = ['F', 'A', 'T', 'E', 'M', 'A2'];
		// Adaptive total width that increases as screen width decreases
		// Base value starts at 50% for larger screens, scales up to 75% for smaller screens
		const widthRatio = Math.max(
			0.5,
			0.65 - (0.25 * Math.min(width, 1920)) / 1920
		);
		const totalWidth = width * widthRatio;
		const spacing = totalWidth / (letters.length - 1);
		const startX = (width - totalWidth) / 2;
		const groupOffset = width * -0.015; // Apply mobile scale to group offset

		// Store canvas width in a separate variable to avoid naming conflicts
		const canvasWidth = width;

		magnets = letters.map((letter, index) => {
			const img = magnetImages[letter];
			// Calculate adaptive scale based on screen width
			// Base scale starts at 1.6 for large screens, reduces more aggressively for smaller screens
			// This makes magnets relatively smaller on smaller screens to avoid overlap
			const screenWidthFactor = Math.min(
				1.0,
				Math.max(0.6, canvasWidth / 1280)
			);
			const adaptiveScale = 1.6 * screenWidthFactor;

			const magnetHeight = img.height * scale * adaptiveScale;
			const magnetWidth = img.width * scale * adaptiveScale;

			// Adjust aspect ratio for mobile devices
			let heightFinal, widthFinal;
			// Progressively adjust for desktop based on screen size
			const sizeAdjust = Math.min(1.0, Math.max(0.8, canvasWidth / 1280));
			heightFinal = magnetHeight * sizeAdjust;
			widthFinal = magnetWidth * sizeAdjust;

			const offset = getLetterOffset(letter, index);

			// Get container height for consistent vertical positioning
			const { height: containerHeight } = getContainerDimensions();

			return {
				id: letter,
				x: startX + spacing * index + offset + groupOffset,
				y: containerHeight * getLetterHeight(letter),
				img: img,
				height: heightFinal,
				width: widthFinal,
				rotation: 0,
				isPickedUp: false,
				scale: 1,
				grabOffsetX: 0,
				grabOffsetY: 0,
			};
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
			if (
				this.offscreenCanvas.width !== width ||
				this.offscreenCanvas.height !== height
			) {
				this.offscreenCanvas.width = width;
				this.offscreenCanvas.height = height;
				this.offscreenCtx = this.offscreenCanvas.getContext('2d');
				this.offscreenCtx.clear();
				this.offscreenCtx.clearRect(
					0,
					0,
					this.offscreenCanvas.width,
					this.offscreenCanvas.height
				);
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
					particles.filter((p) => p.x <= x)
				);
			}
		}

		render(ctx) {
			if (!ctx) return;

			// Initialize or resize offscreen canvas if needed
			this._initOffscreenCanvas(ctx.canvas.width, ctx.canvas.height);

			// Clear the offscreen canvas with transparent background
			this.offscreenCtx.clearRect(
				0,
				0,
				this.offscreenCanvas.width,
				this.offscreenCanvas.height
			);

			// Group particles by their properties for efficient rendering
			const renderGroups = new Map();

			// Process all particles and group them
			for (const [opacity, particleList] of this.particles.entries()) {
				for (const particle of particleList) {
					// Skip if particle is outside viewport
					if (!isInViewport(particle)) continue;

					// Create group key based on visual properties
					const color = particle.color;
					const finalOpacity =
						particle.opacity !== undefined ? particle.opacity : opacity;
					const key = `${color}-${finalOpacity}-${particle.isPredrawn}-${particle.isStampParticle}`;

					if (!renderGroups.has(key)) {
						renderGroups.set(key, {
							color,
							opacity: finalOpacity,
							particles: [],
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

	// Function to create particles along a path
	function createParticlesAlongPath(points, options = {}) {
		const defaultOptions = {
			particleSize: CONFIG.particleSize,
			density: CONFIG.particleDensity,
			randomOffset: CONFIG.lineWidth * 0.3,
		};
		const opts = { ...defaultOptions, ...options };
		let particleIndex = particles.length; // Track index for pattern lookup

		for (let i = 1; i < points.length; i++) {
			const start = points[i - 1];
			const end = points[i];
			const distance = Math.sqrt(
				Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
			);
			const particleCount = Math.min(
				Math.floor(distance * opts.density),
				MAX_PARTICLES - particles.length
			);

			// If we're at max particles, remove oldest ones
			if (particles.length + particleCount > MAX_PARTICLES) {
				particles = particles.slice(-(MAX_PARTICLES - particleCount));
				particleIndex = particles.length;
			}

			for (let j = 0; j < particleCount; j++) {
				const ratio = j / particleCount;
				const x = start.x + (end.x - start.x) * ratio;
				const y = start.y + (end.y - start.y) * ratio;

				// Get deterministic properties based on current index
				const props = getParticleProperties(particleIndex++);

				// Calculate angle based on line direction
				const dx = end.x - start.x;
				const dy = end.y - start.y;
				const angle = Math.atan2(dy, dx);

				// Use pattern table instead of random
				const patternIndex = (j + Math.floor(x + y)) % OFFSET_PATTERNS.length;
				const offset = OFFSET_PATTERNS[patternIndex];

				const perpX = Math.cos(angle) * offset;
				const perpY = Math.sin(angle) * offset;

				particles.push(createParticle(x + perpX, y + perpY));
			}
		}
	}

	function createPreDrawnElements(magnet) {
		if (!magnet) return;

		magnet.isStamping = true;

		preDrawnParticles = [];

		const img = new Image();
		img.onload = () => {
			// Ensure magnet dimensions are set
			if (!magnet.width || !magnet.height) {
				magnet.width = img.width;
				magnet.height = img.height;
			}

			// Create temporary canvas for image
			const tempCanvas = document.createElement('canvas');
			const tempCtx = tempCanvas.getContext('2d');

			// Check if this is the multi-text image
			const isMultiText = img.src.includes('multi-text');

			// Calculate scaled dimensions while maintaining aspect ratio - responsive to screen size
			const { width: containerWidth, height: containerHeight } =
				getContainerDimensions();
			const baseScale = isMultiText ? 1.08 : 0.385; // Base scale factor
			// Adjust scale based on screen dimensions - smaller on smaller screens
			const screenRatio = Math.min(
				containerWidth / 1920,
				containerHeight / 1080
			);
			const scale = baseScale * screenRatio;

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

			// Use scaled dimensions for the canvas
			tempCanvas.width = isMultiText ? scaledWidth : img.width;
			tempCanvas.height = isMultiText ? scaledHeight : img.height;

			// Draw image with scaling for multi-text
			if (isMultiText) {
				tempCtx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
			} else {
				tempCtx.drawImage(img, 0, 0);
			}

			// Get image data using the appropriate dimensions
			const imageData = tempCtx.getImageData(
				0,
				0,
				tempCanvas.width,
				tempCanvas.height
			);
			const data = imageData.data;

			const points = [];
			const alphaThreshold = 100;

			// For predrawn elements, we want consistent density
			const particleDensity = {
				edge: CONFIG.multitextDensity, // Use multitext-specific density
				fill: CONFIG.multitextDensity, // Same density for both edge and fill
			};

			const particleSize = {
				length: CONFIG.particleLength * (0.8 + Math.random() * 0.4), // Maintain 80-120% of length
				width: CONFIG.particleWidth * (0.9 + Math.random() * 0.2), // Maintain 90-110% of width
				randomness: 0.15,
			};

			// Calculate offset to center the stamp particles around the magnet's position
			let offsetX = magnet.width / 2;
			let offsetY = magnet.height / 2;

			if (tempCanvas) {
				offsetX = (tempCanvas.width - magnet.width) / 2;
				offsetY = (tempCanvas.height - magnet.height) / 2;
			}

			// Add specific offsets for multi-text image
			// Use parent dimensions if available
			const { width, height } = getContainerDimensions();
			const multiTextOffsetX = isMultiText ? width * 0.36 : 0; // Half screen minus 15% plus 8vw
			const multiTextOffsetY = isMultiText ? height * 0.3 : 0; // 230px (reduced from 300) minus 15% of height

			if (!saveMultiTextOffsetX) {
				saveMultiTextOffsetX = multiTextOffsetX;
				saveMultiTextOffsetY = multiTextOffsetY;
			}

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
					const i = (y * tempCanvas.width + x) * 4;
					const alpha = data[i + 3];

					if (alpha > alphaThreshold) {
						const leftAlpha = data[i - 4 + 3];
						const rightAlpha = data[i + 4 + 3];
						const topAlpha = data[i - tempCanvas.width * 4 + 3];
						const bottomAlpha = data[i + tempCanvas.width * 4 + 3];

						const isEdge =
							leftAlpha <= alphaThreshold ||
							rightAlpha <= alphaThreshold ||
							topAlpha <= alphaThreshold ||
							bottomAlpha <= alphaThreshold;

						const newX =
							magnet.x - magnet.width / 2 + (x - offsetX) + multiTextOffsetX;
						const newY =
							magnet.y - magnet.height / 2 + (y - offsetY) + multiTextOffsetY;

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
				const particle = createParticle(point.x, point.y, true, true);
				particle.magnetId = magnet.id;
				particle.opacity = CONFIG.multitextOpacity;
				preDrawnParticles.push(particle);
				spatialGrid.addParticle(particle); // Add to spatial grid
			});

			// Reset the stamping flag after a delay
			setTimeout(() => {
				magnet.isStamping = false;
			}, 300);

			scheduleRender();
		};

		img.src = multiText;
	}

	// Handle mouse events
	function handleMousemove(event) {
		lastInteractionTime = performance.now();
		if (isIdle) {
			isIdle = false;
			FRAME_INTERVAL = 1000 / CONFIG.targetFPS;
		}

		// Get pointer position for internal canvas operations
		let pos = getPointerPos(event);

		// Use raw coordinates for visual cursor positioning
		// (unscaled display coordinates for visual accuracy)
		m.x = event.rawCoords.x - 5;
		m.y = event.rawCoords.y - 5;

		// Stop magnet interactions if transitioning
		if (isTransitioning) {
			isHoveringMagnet = false;
			hoveredMagnet = null;
			return;
		}

		// Check if hovering over any magnet
		if (canvas) {
			const rect = canvas.getBoundingClientRect();
			const x = pos.x - rect.left;
			const y = pos.y - rect.top;

			isHoveringMagnet = magnets.some((magnet) => {
				const scale = magnet.scale || 1;
				const width = magnet.width * scale;
				const height = magnet.height * scale;

				// Calculate the actual render position (centered)
				const magnetX = magnet.x - width / 2;
				const magnetY = magnet.y - height / 2;

				// Add minimal padding for hover detection
				const padding = 5;
				return (
					x >= magnetX - padding &&
					x <= magnetX + width + padding &&
					y >= magnetY - padding &&
					y <= magnetY + height + padding
				);
			});
			hoveredMagnet = findClickedMagnet({ x, y });

			// Update cursor style based on hover and drag state
			if (isDraggingMagnet) {
				document.body.style.cursor = 'grabbing';
			} else if (isHoveringMagnet) {
				document.body.style.cursor = 'grab';
			} else {
				document.body.style.cursor = 'default';
			}
		}

		// Only animate if cursor opacity is 0
		if (cursorOpacity === 0) {
			const obj = { value: 0 };
			gsap.to(obj, {
				value: 1,
				duration: 0.3,
				ease: 'power2.out',
				onUpdate: () => {
					cursorOpacity = obj.value;
				},
			});
		}
	}

	function handleMousedown(e) {
		let pos = getPointerPos(e);
		lastInteractionTime = performance.now();
		if (isIdle) {
			isIdle = false;
			FRAME_INTERVAL = 1000 / CONFIG.targetFPS;
		}
		isClicking = true;

		if (isTransitioning) return;

		if (isHoveringMagnet && hoveredMagnet) {
			//
			// Start magnet drag
			isDraggingMagnet = true;
			// Update cursor to grabbing when starting to drag
			document.body.style.cursor = 'grabbing';
			selectedMagnet = hoveredMagnet;
			selectedMagnet.grabOffsetX = hoveredMagnet.x - pos.x;
			selectedMagnet.grabOffsetY = hoveredMagnet.y - pos.y;
			lastMouseX = pos.x;
			lastMouseY = pos.y;
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

		if (isTransitioning) return;

		if (isDraggingMagnet && selectedMagnet) {
			const droppedMagnet = selectedMagnet;
			isDraggingMagnet = false;

			// Reset cursor based on whether still hovering over a magnet
			if (isHoveringMagnet) {
				document.body.style.cursor = 'grab';
			} else {
				document.body.style.cursor = 'default';
			}
			const finalRotation = Math.round(droppedMagnet.rotation / 5) * 5;

			// Check canvas bounds and get corrected position
			const boundedPosition = checkCanvasBounds(droppedMagnet);

			gsap.killTweensOf(droppedMagnet);
			gsap.to(droppedMagnet, {
				x: boundedPosition.x,
				y: boundedPosition.y,
				scale: 1,
				rotation: 0,
				duration: 0.3,
				ease: 'power2.out',
				onUpdate: () => scheduleRender(),
				onComplete: () => {
					droppedMagnet.isPickedUp = false;
					// Create stamp after animation completes with final position
					createMagnetStamp(droppedMagnet);
					restoreMagnetPosition(droppedMagnet, selectedMagnetIndex);
					selectedMagnet = null;
					selectedMagnetIndex = -1;
					scheduleRender();
				},
			});
		}
	}

	function updateMouseVelocity(e) {
		let pos = getPointerPos(e);
		if (!lastMouseX || !lastMouseY) {
			lastMouseX = pos.x;
			lastMouseY = pos.y;
			return;
		}

		mouseVelocityX = pos.x - lastMouseX;
		mouseVelocityY = pos.y - lastMouseY;
		lastMouseX = pos.x;
		lastMouseY = pos.y;
	}

	function checkCollision(magnet1, magnet2) {
		// Use a smaller collision box (90% of original size)
		const collisionScale = 0.9;

		// Calculate the width and height reduction
		const widthReduction1 = (magnet1.width * (1 - collisionScale)) / 2;
		const heightReduction1 = (magnet1.height * (1 - collisionScale)) / 2;
		const widthReduction2 = (magnet2.width * (1 - collisionScale)) / 2;
		const heightReduction2 = (magnet2.height * (1 - collisionScale)) / 2;

		// Check collision with reduced boxes
		return !(
			magnet1.x + widthReduction1 >
				magnet2.x + magnet2.width - widthReduction2 ||
			magnet1.x + magnet1.width - widthReduction1 <
				magnet2.x + widthReduction2 ||
			magnet1.y + heightReduction1 >
				magnet2.y + magnet2.height - heightReduction2 ||
			magnet1.y + magnet1.height - heightReduction1 <
				magnet2.y + heightReduction2
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

	// Function to resolve collisions between magnets during transition
	function resolveCollisionsForTransition(magnets, newPositions) {
		// Create a copy of magnets with their new positions for collision checking
		const magnetsCopy = magnets.map((magnet, index) => ({
			...magnet,
			originalIndex: index,
			newX: newPositions[index].x,
			newY: newPositions[index].y,
			moved:
				Math.abs(newPositions[index].x - magnet.x) > 5 ||
				Math.abs(newPositions[index].y - magnet.y) > 5,
		}));

		// Sort by distance moved (largest first) to prioritize magnets that need to move most
		magnetsCopy.sort((a, b) => {
			if (!a.moved && b.moved) return 1;
			if (a.moved && !b.moved) return -1;

			const distA = Math.sqrt(
				Math.pow(a.newX - a.x, 2) + Math.pow(a.newY - a.y, 2)
			);
			const distB = Math.sqrt(
				Math.pow(b.newX - b.x, 2) + Math.pow(b.newY - b.y, 2)
			);
			return distB - distA; // Descending order
		});

		// Process each magnet to resolve collisions
		for (let i = 0; i < magnetsCopy.length; i++) {
			const current = magnetsCopy[i];

			// Skip magnets that don't need to move
			if (!current.moved) continue;

			// Create a temporary magnet with the new position
			const tempMagnet = {
				...current,
				x: current.newX,
				y: current.newY,
			};

			// Check for collisions with other magnets at their new positions
			let hasCollision = false;

			for (let j = 0; j < magnetsCopy.length; j++) {
				if (i === j) continue; // Skip self

				const other = magnetsCopy[j];
				const otherMagnet = {
					...other,
					x: other.newX,
					y: other.newY,
				};

				if (checkCollision(tempMagnet, otherMagnet)) {
					hasCollision = true;
					break;
				}
			}

			// If there's a collision, find a free space
			if (hasCollision) {
				// Create array of other magnets at their new positions
				const otherMagnets = magnetsCopy
					.filter((_, idx) => idx !== i)
					.map((m) => ({
						...m,
						x: m.newX,
						y: m.newY,
					}));

				// Find a free space starting from the current new position
				const startingPoint = {
					...current,
					x: current.newX,
					y: current.newY,
				};

				const freePosition = findFreeSpace(startingPoint, otherMagnets);

				if (freePosition) {
					// Update the new position
					current.newX = freePosition.x;
					current.newY = freePosition.y;
				}
			}

			// Update the original newPositions array
			newPositions[current.originalIndex] = {
				x: current.newX,
				y: current.newY,
			};
		}

		return newPositions;
	}

	function checkCanvasBounds(magnet) {
		if (!canvas) return { x: magnet.x, y: magnet.y };

		const scale = magnet.scale || 1;
		const width = magnet.width * scale;
		const height = magnet.height * scale;

		// Standard padding for normal operation
		const padding = 15;

		// Calculate bounds with padding
		let x = magnet.x;
		let y = magnet.y;

		if (useVirtualBoundary) {
			// Create a virtual boundary (75% of canvas size) for transition
			const virtualBoundaryScale = 0.62;
			const virtualWidth = canvas.width * virtualBoundaryScale;
			const virtualHeight = canvas.height * virtualBoundaryScale;

			// Calculate offset to center the virtual boundary
			const offsetX = (canvas.width - virtualWidth) / 2;
			const offsetY = (canvas.height - virtualHeight) / 2;

			// Constrain to virtual boundary
			x = Math.max(offsetX + width / 2, x);
			x = Math.min(offsetX + virtualWidth - width / 2, x);
			y = Math.max(offsetY + height / 2, y);
			y = Math.min(offsetY + virtualHeight - height / 2, y);
		} else {
			// Standard boundary checking for normal operation
			// Left boundary
			x = Math.max(width / 2 + padding, x);
			// Right boundary
			x = Math.min(canvas.width - width / 2 - padding, x);
			// Top boundary
			y = Math.max(height / 2 + padding, y);
			// Bottom boundary
			y = Math.min(canvas.height - height / 2 - padding, y);
		}

		return { x, y };
	}

	function handleCanvasMouseEnter(e) {
		gsap.to(
			{ value: cursorOpacity },
			{
				value: 1,
				duration: 0.3,
				ease: 'power2.out',
				onUpdate: function () {
					cursorOpacity = this.targets()[0].value;
				},
			}
		);
		shouldDraw = true;
		// Capture initial point on enter
		const pos = getPointerPos(e);
		lastX = pos.x;
		lastY = pos.y;
	}

	function handleCanvasMouseLeave() {
		gsap.to(
			{ value: cursorOpacity },
			{
				value: 0,
				duration: 0.3,
				ease: 'power2.out',
				onUpdate: function () {
					cursorOpacity = this.targets()[0].value;
				},
			}
		);
		// Reset drawing state when leaving canvas
		lastX = null;
		lastY = null;
		shouldDraw = false;
	}

	let threeSceneComponent;
	let scrollToExploreComponent;
	let isMobileMode = false;
	// Flag to indicate when we should use a more restrictive virtual boundary for magnets
	let useVirtualBoundary = false;
	let isScrollAnimating = false;
	let isCanvasVisible = true;

	let isTransitioning = false;

	// Function to move stamp particles with their associated magnet
	function moveStampParticlesWithMagnet(magnetId, deltaX, deltaY) {
		// Only proceed if there's actual movement
		if (deltaX === 0 && deltaY === 0) return;

		// Remove particles from spatial grid before updating positions
		stampParticles.forEach((particle) => {
			if (particle.magnetId === magnetId) {
				spatialGrid.removeParticle(particle);
			}
		});

		// Update positions
		stampParticles.forEach((particle) => {
			if (particle.magnetId === magnetId) {
				particle.x += deltaX;
				particle.y += deltaY;
				// Re-add particle to spatial grid with updated position
				spatialGrid.addParticle(particle);
			}
		});

		// Schedule a render to update the visual
		scheduleRender();
	}

	function handleTransitionStart() {
		isTransitioning = true;
		shouldDraw = false;
	}

	function handleSnapBackStart() {
		setTimeout(() => {
			// Clear all particle arrays
			particles = [];
			stampParticles = [];
			preDrawnParticles = [];

			// Clear all batches
			drawingBatch.clear();
			predrawnBatch.clear();
			stampBatch.clear();

			// Reset drawing state
			shouldDraw = false;

			// Force a render to update the canvas
			renderAll();
		}, 300); // 0.3 second delay
	}

	function handleTransitionComplete() {
		// Fade out the canvas
		gsap.to(canvas, {
			opacity: 0,
			duration: 0.15,
			ease: 'power2.inOut',
			onComplete: () => {
				isCanvasVisible = false;
			},
		});
	}

	// Handler for when the model is facing away from the user during rotation
	function handleModelFacingAway() {
		// Apply the virtual boundary to all magnets while model is facing away
		if (magnets && magnets.length > 0 && canvas) {
			// Enable virtual boundary if not already enabled
			useVirtualBoundary = true;

			// Get new positions using virtual boundary
			const newPositions = magnets.map((magnet) => {
				return checkCanvasBounds(magnet);
			});

			// Resolve any collisions between magnets
			const collisionFreePositions = resolveCollisionsForTransition(
				magnets,
				newPositions
			);

			// Apply new positions immediately (while model is facing away)
			magnets.forEach((magnet, index) => {
				magnet.x = collisionFreePositions[index].x;
				magnet.y = collisionFreePositions[index].y;
			});

			// Force redraw to apply new positions
			renderAll();
		}
	}

	function handleWheel(event) {
		if (Math.abs(event.deltaY) < 10) return;

		if (!hasTriggeredTransition) {
			hasTriggeredTransition = true;

			// Reset cursor to default when triggering scroll animation
			document.body.style.cursor = 'default';

			if (scrollToExploreComponent && !scrollToExploreComponent.hasAnimated) {
				isScrollAnimating = true;
				scrollToExploreComponent.startAnimation().then(() => {
					isScrollAnimating = false;
				});
			}

			if (threeSceneComponent) {
				// Enable virtual boundary for magnets but don't reposition yet
				// The repositioning will happen when the model is facing away
				useVirtualBoundary = true;

				// Start 3D transition first
				threeSceneComponent.startTransition();
				dispatch('transitionstart');
			}
		}
	}

	function handleWipe({ detail: { progress } }) {
		// Clear particles based on wipe progress
		const canvasWidth = canvas?.width || 0;
		const clearX = (1 - progress) * canvasWidth; // Invert progress for left-to-right clearing

		// Keep particles to the right of clearX
		particles = particles.filter((p) => p.x > clearX);
		stampParticles = stampParticles.filter((p) => p.x > clearX);
		preDrawnParticles = preDrawnParticles.filter((p) => p.x > clearX);

		// Notify parent window of wipe start
		const message = {
			type: 'wipeStart',
		};
		// Update to live link later
		window.parent.postMessage(message, 'https://fatscradle.com/');

		// Force a render to update the canvas
		renderAll();
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
		particles = particles.filter((p) => p.x <= x);
		stampParticles = stampParticles.filter((p) => p.x <= x);
		preDrawnParticles = preDrawnParticles.filter((p) => p.x <= x);

		// Remove particles from batches
		drawingBatch.clearToX(x);
		predrawnBatch.clearToX(x);
		stampBatch.clearToX(x);

		renderAll();
	}
</script>

<svelte:window
	on:mousemove={handleMousemove}
	on:mousedown={handleMousedown}
	on:resize={() => {
		if (typeof window !== 'undefined') {
			window.clearTimeout(resizeInterval);
			resizeInterval = window.setTimeout(() => {
				if (!hasTriggeredTransition) resize();
			}, 100); // Increased delay for better performance
		}
	}}
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
		class:hidden={!isCanvasVisible || !$isDesktop}
		on:pointermove={handlePointerMove}
		on:pointerdown={handlePointerDown}
		on:pointerup={handlePointerUp}
		on:pointerleave={handlePointerLeave}
	></canvas>
	<ThreeScene
		bind:this={threeSceneComponent}
		{canvas}
		on:transitionstart={handleTransitionStart}
		on:snapbackstart={handleSnapBackStart}
		on:transitioncomplete={handleTransitionComplete}
		on:facingAway={handleModelFacingAway}
		on:wipe={({ detail: { progress } }) => {
			// Clear particles based on wipe progress
			const canvasWidth = canvas.width;
			const clearX = (1 - progress) * canvasWidth; // Invert progress for left-to-right clearing

			// Keep particles to the right of clearX
			particles = particles.filter((p) => p.x > clearX);
			stampParticles = stampParticles.filter((p) => p.x > clearX);
			preDrawnParticles = preDrawnParticles.filter((p) => p.x > clearX);
			const message = {
				type: 'wipeStart',
			};
			//update to live link
			window.parent.postMessage(message, 'https://fatscradle.com/');
			// Force a render to update the canvas
			renderAll();
		}}
	/>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		/* cursor: none; Hide the default cursor */
	}

	/* Ensure all elements within the canvas container have cursor: none */
	/* .canvas-container,
	.canvas-container * {
		cursor: none !important;
	} */

	.canvas-container {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 1;
		overflow: hidden;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	canvas {
		opacity: 1;
		transition: opacity 0.15s ease;
		position: absolute;
		top: 0;
		left: 0;
		margin: 0;
		padding: 0;
		display: block;
		backface-visibility: hidden;
		transform-origin: center center;
	}

	canvas.hidden {
		opacity: 0;
		pointer-events: none;
	}

	/* .cursor {
		position: fixed;
		top: -6px;
		left: -20px;
		pointer-events: none;
		z-index: 9999;
		width: 90px;
		height: 90px;
		transform-origin: center;
	}

	.cursor img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	} */

	/* CSS for scroll-to-explore moved to +page.svelte with the component
	.scroll-to-explore {
		pointer-events: none;
		position: absolute;
		top: 8vh;
		height: 10vh;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10;
		opacity: 1;
	}
	*/
</style>
