<script>
	import { onMount, createEventDispatcher, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
	import gsap from 'gsap';

	export let canvas; // Accept canvas from parent

	let container;
	let scene;
	let camera;
	let renderer;
	let model;
	let screenMesh;
	let sliderMesh;
	let isSliderDragging = false;
	let sliderStartX = 0;
	let sliderInitialPosition;
	let sliderMinX, sliderMaxX;
	let isVisible = false;
	let modelLoaded = false;
	let animationFrameId;
	let canvasTexture;
	let meshAspect; // Store mesh aspect ratio at module level
	let knobWidth = 0;

	function updateCanvasTexture() {
		if (!canvas) return;

		if (!canvasTexture) {
			canvasTexture = new THREE.CanvasTexture(canvas);
		}

		// Update all texture properties
		const textureProps = {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			generateMipmaps: false,
			encoding: THREE.sRGBEncoding,
			flipY: true,
			wrapS: THREE.ClampToEdgeWrapping,
			wrapT: THREE.ClampToEdgeWrapping,
		};

		Object.assign(canvasTexture, textureProps);
		canvasTexture.repeat.set(-1, 1);
		canvasTexture.offset.set(1, 0);
		canvasTexture.needsUpdate = true;

		// If screen mesh exists, update its material
		if (screenMesh?.material) {
			screenMesh.material.map = canvasTexture;
		}
	}

	// Make canvas updates trigger texture updates
	$: if (canvas) {
		updateCanvasTexture();
	}

	const CONFIG = {
		model: {
			path: '/models/MagnaSketch_3dModel.gltf',
			initial: {
				position: { x: 0, y: 0, z: 0 }, // Centered at origin
				rotation: { x: 0, y: 0, z: 0 },
				scale: { x: 1, y: 1, z: 1 }, // Will be calculated dynamically
			},
			final: {
				position: { x: 0, y: 0, z: -2 },
				rotation: { x: 0, y: Math.PI * 2, z: 0 },
				scale: { x: 1.5, y: 1.5, z: 1.5 },
			},
		},
		camera: {
			fov: 35, // Narrower FOV for less perspective distortion
			near: 0.1,
			far: 800,
			position: { x: 0, y: 0, z: 10 }, // Further back to accommodate full screen
		},
		lighting: {
			ambient: {
				color: 0xffffff,
				intensity: 1.0, // Doubled ambient light
			},
			directional: {
				color: 0xffffff,
				intensity: 2.0, // Much stronger main light
				position: { x: 4, y: 5, z: 2 }, // Higher and more to the right
			},
			pointLights: [
				{
					color: 0xffffff,
					intensity: 1.5, // Doubled
					position: { x: -2, y: 4, z: 3 }, // Left front top
				},
				{
					color: 0xffffff,
					intensity: 2.0, // Stronger right light
					position: { x: 5, y: 5, z: 1 }, // Higher right front top
				},
				{
					color: 0xffffff,
					intensity: 1.5, // Stronger front light
					position: { x: 0, y: 3, z: 4 }, // Higher center front
				},
				{
					color: 0xffffff,
					intensity: 1.0, // Additional fill light
					position: { x: 3, y: 2, z: 3 }, // Right front middle
				},
				{
					color: 0xffffff,
					intensity: 1.0, // Additional fill light
					position: { x: -3, y: 2, z: 3 }, // Left front middle
				},
			],
		},
		animation: {
			duration: 2.0, // Slightly faster main animation
			delay: 0.5, // Shorter initial delay
			wipeDelay: 2.0, // 2 second delay before wipe
			sliderDelay: 0.4, // Start slider movement sooner
			sliderDuration: 1.6, // Faster slider movement
			snapBackDelay: 0, // Immediate snap back
			snapBackDuration: 0.3, // Quick snap back
		},
	};

	let isTransitioning = false;
	let isFirstTransitionComplete = false;
	let totalScrollAmount = 0;
	let currentSliderPosition = 0;
	const SCROLL_SENSITIVITY = 0.0005; // Reduced sensitivity
	let isDragging = false;
	let dragOffset = 0;
	let scrollAnimation;
	let scrollTimeout;
	const dispatch = createEventDispatcher();

	// Function to calculate effective track length accounting for knob width
	function getEffectiveTrackLength() {
		return sliderMaxX - sliderMinX - knobWidth;
	}

	// Function to convert world position to normalized position (0-1)
	function worldToNormalizedPosition(worldX) {
		const effectiveMin = sliderMinX + knobWidth / 2;
		const effectiveMax = sliderMaxX - knobWidth / 2;
		return (worldX - effectiveMin) / (effectiveMax - effectiveMin);
	}

	// Function to convert normalized position (0-1) to world position
	function normalizedToWorldPosition(normalized) {
		const effectiveMin = sliderMinX + knobWidth / 2;
		const effectiveMax = sliderMaxX - knobWidth / 2;
		return effectiveMin + normalized * (effectiveMax - effectiveMin);
	}

	// Reactive statement to update slider position whenever currentSliderPosition changes
	$: if (sliderMesh && isFirstTransitionComplete) {
		const newX = sliderMinX + (sliderMaxX - sliderMinX) * currentSliderPosition;
		sliderMesh.position.x = newX;
	}

	function updateSliderPosition(x, immediate = false) {
		if (!sliderMesh) return;

		// Clamp to bounds
		const newX = Math.max(sliderMinX, Math.min(sliderMaxX, x));

		if (immediate) {
			// Direct update for dragging
			sliderMesh.position.x = newX;
			// Immediately update wipe effect for dragging
			const progress = calculateWipeProgress(newX);
			dispatch('wipe', { progress });
		} else {
			// Animated update for scrolling
			if (scrollAnimation) scrollAnimation.kill();

			scrollAnimation = gsap.to(sliderMesh.position, {
				x: newX,
				duration: 0.5, // Longer duration
				ease: 'power3.out', // Smoother easing
				onUpdate: () => {
					// Calculate and dispatch progress during animation
					const progress = calculateWipeProgress(sliderMesh.position.x);
					dispatch('wipe', { progress });
				},
			});
		}

		// Calculate normalized position
		currentSliderPosition = (newX - sliderMinX) / (sliderMaxX - sliderMinX);
		totalScrollAmount = currentSliderPosition;

		// Check if we've reached the end
		if (currentSliderPosition >= 1) {
			let iframeElement = document.getElementById('iframe');
            let test = document.querySelectorAll('[data-id="67a9639504763da79d6610b4"]');
			console.log(test, '<-- test', iframeElement, 'end of animations');
			emitEndAnimationEvent();
			window.removeEventListener('wheel', handlePostTransitionScroll);
		}
	}

	function emitEndAnimationEvent() {
		const event = new CustomEvent('iframeScrolled', {
			detail: { message: 'Iframe Scrolled!' },
		});
		window.dispatchEvent(event);
	}

	function calculateWipeProgress(x) {
		// Invert the progress since we want to clear from left to right
		return 1 - (x - sliderMinX) / (sliderMaxX - sliderMinX);
	}

	function handleMouseDown(event) {
		if (!isFirstTransitionComplete || !sliderMesh) return;

		// Convert mouse coordinates to normalized device coordinates (-1 to +1)
		mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
		mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

		// Update the picking ray with the camera and mouse position
		raycaster.setFromCamera(mouse, camera);

		// Calculate objects intersecting the picking ray
		const intersects = raycaster.intersectObject(sliderMesh, true);

		if (intersects.length > 0) {
			isDragging = true;

			// Get screen coordinates
			const rect = container.getBoundingClientRect();

			// Project current slider position to screen space
			const sliderPos = new THREE.Vector3(
				sliderMesh.position.x,
				sliderMesh.position.y,
				sliderMesh.position.z
			);
			sliderPos.project(camera);
			const sliderScreenX = ((sliderPos.x + 1) * rect.width) / 2;

			// Calculate and store the offset from the cursor to the knob center
			dragOffset = event.clientX - sliderScreenX;
		}
	}

	function handleMouseMove(event) {
		if (!isDragging || !isFirstTransitionComplete || !sliderMesh) return;

		// Get screen coordinates
		const rect = container.getBoundingClientRect();

		// Adjust mouse position by the initial drag offset
		const adjustedX = event.clientX - dragOffset;
		const x = adjustedX - rect.left;

		// Project slider bounds to screen space
		const minPoint = new THREE.Vector3(
			sliderMinX,
			sliderMesh.position.y,
			sliderMesh.position.z
		);
		const maxPoint = new THREE.Vector3(
			sliderMaxX,
			sliderMesh.position.y,
			sliderMesh.position.z
		);

		// Convert to screen space
		minPoint.project(camera);
		maxPoint.project(camera);

		// Convert to pixel coordinates
		const minScreenX = ((minPoint.x + 1) * rect.width) / 2;
		const maxScreenX = ((maxPoint.x + 1) * rect.width) / 2;

		// Calculate position within track bounds
		const trackScreenWidth = maxScreenX - minScreenX;
		const mouseOffset = x - minScreenX;
		const progress = Math.max(0, Math.min(1, mouseOffset / trackScreenWidth));

		// Convert screen position back to world space
		const worldX = sliderMinX + (sliderMaxX - sliderMinX) * progress;
		updateSliderPosition(worldX, true); // Use immediate update for dragging
	}

	function handleMouseUp() {
		isDragging = false;
		dragOffset = 0;
	}

	function handlePostTransitionScroll(event) {
		if (!isFirstTransitionComplete || !sliderMesh || isDragging) return;

		// Clear any existing timeout
		if (scrollTimeout) clearTimeout(scrollTimeout);

		// Debounce the scroll updates
		scrollTimeout = setTimeout(() => {
			// Accumulate scroll amount and clamp it between 0 and 1
			currentSliderPosition = Math.max(
				0,
				Math.min(1, currentSliderPosition + event.deltaY * SCROLL_SENSITIVITY)
			);
			totalScrollAmount = currentSliderPosition;

			// Convert to world position and update with animation
			const worldX =
				sliderMinX + (sliderMaxX - sliderMinX) * currentSliderPosition;
			updateSliderPosition(worldX, false); // Use animated update for scrolling
		}, 16); // ~60fps timing
	}

	// Create a raycaster for slider interaction
	const raycaster = new THREE.Raycaster();
	const mouse = new THREE.Vector2();

	// Function to setup clipping planes
	function setupClippingPlanes() {
		if (!screenMesh || !canvas) return;

		// Get original mesh dimensions
		const box = new THREE.Box3().setFromObject(screenMesh);
		const meshWidth = box.max.x - box.min.x;
		const meshHeight = box.max.y - box.min.y;

		// Get canvas aspect ratio
		const canvasAspect = canvas.width / canvas.height;

		// Calculate scale to fit height
		const heightScale = 1.0; // Keep original height
		const widthScale = (canvasAspect / (meshWidth / meshHeight)) * 1.2; // Add 20% to width

		// Update mesh scale
		screenMesh.scale.y = heightScale;
		screenMesh.scale.x = widthScale;

		// Set clipping planes at original mesh boundaries
		const clipOffset = meshWidth * 0.5; // Keep original clipping

		// Create new material with clipping planes
		if (screenMesh.material) {
			screenMesh.material.dispose();
		}

		const materialOptions = {
			transparent: true,
			opacity: 1,
			side: THREE.DoubleSide,
			toneMapped: false,
			clippingPlanes: [
				new THREE.Plane(new THREE.Vector3(1, 0, 0), clipOffset), // Right clip
				new THREE.Plane(new THREE.Vector3(-1, 0, 0), clipOffset), // Left clip
			],
		};

		// Only add the map if canvasTexture exists
		if (canvasTexture) {
			materialOptions.map = canvasTexture;
		}

		screenMesh.material = new THREE.MeshBasicMaterial(materialOptions);

		// Ensure clipping is enabled in renderer
		if (renderer) {
			renderer.localClippingEnabled = true;
		}
	}

	async function initThreeJS() {
		scene = new THREE.Scene();

		// Add ambient light
		const ambientLight = new THREE.AmbientLight(
			CONFIG.lighting.ambient.color,
			CONFIG.lighting.ambient.intensity
		);
		scene.add(ambientLight);

		// Add main directional light
		const directionalLight = new THREE.DirectionalLight(
			CONFIG.lighting.directional.color,
			CONFIG.lighting.directional.intensity
		);
		directionalLight.position.set(
			CONFIG.lighting.directional.position.x,
			CONFIG.lighting.directional.position.y,
			CONFIG.lighting.directional.position.z
		);
		directionalLight.castShadow = true;
		scene.add(directionalLight);

		// Add point lights for better coverage
		CONFIG.lighting.pointLights.forEach((light) => {
			const pointLight = new THREE.PointLight(light.color, light.intensity);
			pointLight.position.set(
				light.position.x,
				light.position.y,
				light.position.z
			);
			scene.add(pointLight);
		});

		camera = new THREE.PerspectiveCamera(
			CONFIG.camera.fov,
			window.innerWidth / window.innerHeight,
			CONFIG.camera.near,
			CONFIG.camera.far
		);
		camera.position.set(
			CONFIG.camera.position.x,
			CONFIG.camera.position.y,
			CONFIG.camera.position.z
		);
		camera.lookAt(0, 0, 0);

		renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true,
		});
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.outputEncoding = THREE.sRGBEncoding;
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		container.appendChild(renderer.domElement);

		await loadModel();

		// Start render loop
		animate();
	}

	async function loadModel() {
		const loader = new GLTFLoader();
		loader.resourcePath = '/models/'; // Set resource path for textures and other assets
		try {
			const gltf = await loader.loadAsync(CONFIG.model.path);
			model = gltf.scene;

			// Handle materials to prevent texture loading errors and enhance lighting
			model.traverse((child) => {
				if (child.isMesh) {
					if (child.material) {
						// Remove texture references if they don't exist
						if (child.material.normalMap && !child.material.normalMap.image) {
							child.material.normalMap = null;
						}
						if (
							child.material.roughnessMap &&
							!child.material.roughnessMap.image
						) {
							child.material.roughnessMap = null;
						}
						if (
							child.material.metalnessMap &&
							!child.material.metalnessMap.image
						) {
							child.material.metalnessMap = null;
						}

						// Special handling for the white text
						if (child.name === 'Curve003_1') {
							child.material.roughness = 0.2; // Very smooth for more reflection
							child.material.metalness = 0.1; // Minimal metalness for cleaner white
							child.material.emissive = new THREE.Color(0xffffff); // Add white glow
							child.material.emissiveIntensity = 0.2; // Subtle glow
						} else {
							// Default material properties for other meshes
							child.material.roughness = 0.4;
							child.material.metalness = 0.2;
						}

						child.castShadow = true;
						child.receiveShadow = true;
					}
				}
			});

			// Add a specific light for the logo text
			const logoLight = new THREE.PointLight(0xffffff, 0.8);
			logoLight.position.set(3, 4, 1); // Moved further top-right (x: right, y: up, z: forward)
			model.add(logoLight);

			// Find screen and slider meshes
			let foundScreen = false;
			model.traverse((child) => {
				if (child.name === 'Screen') {
					foundScreen = true;
					screenMesh = child;

					// Create material without texture initially
					if (screenMesh.material) {
						screenMesh.material.dispose();
					}

					screenMesh.material = new THREE.MeshBasicMaterial({
						transparent: true,
						opacity: 1,
						side: THREE.DoubleSide,
						toneMapped: false,
					});

					// If we already have a canvas texture, set it now
					if (canvasTexture) {
						screenMesh.material.map = canvasTexture;
					}

					// Set up initial clipping planes
					setupClippingPlanes();

					// Reset UV coordinates
					const uvs = screenMesh.geometry.attributes.uv;
					for (let i = 0; i < uvs.count; i++) {
						const u = uvs.array[i * 2];
						const v = uvs.array[i * 2 + 1];
						uvs.array[i * 2] = u;
						uvs.array[i * 2 + 1] = v;
					}
					uvs.needsUpdate = true;

					// Rotate the mesh locally
					screenMesh.rotateZ(Math.PI);
				} else if (child.name === 'Slider') {
					sliderMesh = child;
					sliderInitialPosition = child.position.clone();
					sliderMinX = -1.47;
					sliderMaxX = 1.47;
					sliderMesh.position.x = sliderMinX; // Start from left side

					// Calculate knob width using bounding box
					const bbox = new THREE.Box3().setFromObject(sliderMesh);
					knobWidth = bbox.max.x - bbox.min.x;
				}
			});

			if (!foundScreen) {
				throw new Error('No screen mesh found in model');
			}

			// Set initial position and rotation
			model.position.set(
				CONFIG.model.initial.position.x,
				CONFIG.model.initial.position.y,
				CONFIG.model.initial.position.z
			);
			model.rotation.set(
				CONFIG.model.initial.rotation.x,
				CONFIG.model.initial.rotation.y,
				CONFIG.model.initial.rotation.z
			);

			// Calculate and set initial scale to match screen
			const screenScale = calculateScreenMatchingScale();
			model.scale.set(screenScale.x, screenScale.y, screenScale.z);

			scene.add(model);
			modelLoaded = true;
		} catch (error) {
			console.error('Error loading model:', error);
			throw error;
		}
	}

	// Calculate scale to match screen dimensions
	function calculateScreenMatchingScale() {
		if (!screenMesh || !camera) return { x: 1, y: 1, z: 1 };

		// Get the camera's field of view in radians
		const fovRad = (CONFIG.camera.fov * Math.PI) / 180;

		// Calculate the visible height at the model's position
		const distance = Math.abs(camera.position.z - model.position.z);
		const visibleHeight = 2 * Math.tan(fovRad / 2) * distance;

		// Get the screen mesh's current dimensions
		const box = new THREE.Box3().setFromObject(screenMesh);
		const meshHeight = box.max.y - box.min.y;

		// Calculate scale needed to match screen height
		const scale = visibleHeight / meshHeight;

		return { x: scale, y: scale, z: scale };
	}

	function animate() {
		if (!modelLoaded) return;

		requestAnimationFrame(animate);

		// Update canvas texture if it exists and canvas is valid
		if (canvasTexture && canvas) {
			canvasTexture.needsUpdate = true;
		}

		renderer.render(scene, camera);
	}

	function updateScreenAspect() {
		if (screenMesh && screenMesh.geometry) {
			const windowAspect = window.innerWidth / window.innerHeight;

			// Get original mesh dimensions (before any scaling)
			screenMesh.scale.x = 1; // Reset scale temporarily
			const box = new THREE.Box3().setFromObject(screenMesh);
			const meshWidth = box.max.x - box.min.x;
			const meshHeight = box.max.y - box.min.y;
			const aspect = meshWidth / meshHeight;

			// Scale mesh to match window aspect ratio
			const scaleX = windowAspect / aspect;
			screenMesh.scale.x = scaleX;
		}
	}

	function handleResize() {
		if (!screenMesh || !canvas) return;

		// Update camera
		const aspect = window.innerWidth / window.innerHeight;
		camera.aspect = aspect;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);

		// Update screen mesh clipping and scale
		setupClippingPlanes();
	}

	export function startTransition() {
		if (!modelLoaded || !model || isTransitioning) return;

		isTransitioning = true;
		dispatch('transitionstart');

		// Ensure clipping planes are set up before animation
		setupClippingPlanes();

		// Start invisible and show after scroll animation + delay
		isVisible = false;
		gsap.to(
			{},
			{
				duration: CONFIG.animation.delay + 0.2,
				onComplete: () => {
					isVisible = true;
					dispatch('transitioncomplete');
				},
			}
		);

		// Animation sequence
		const timeline = gsap.timeline({
			delay: CONFIG.animation.delay,
			onComplete: () => {
				isTransitioning = false;
				isFirstTransitionComplete = true;
				// Remove initial wheel listener
				window.removeEventListener('wheel', handleWheel);
				// Add new scroll listener for wipe animation
				window.addEventListener('wheel', handlePostTransitionScroll);
			},
		});

		// Animate scale down and rotate
		timeline
			.to(model.position, {
				z: CONFIG.model.final.position.z,
				duration: CONFIG.animation.duration,
				ease: 'power2.inOut',
			})
			.to(
				model.rotation,
				{
					y: CONFIG.model.final.rotation.y,
					duration: CONFIG.animation.duration,
					ease: 'power2.inOut',
				},
				0
			)
			.to(
				model.scale,
				{
					x: CONFIG.model.final.scale.x,
					y: CONFIG.model.final.scale.y,
					z: CONFIG.model.final.scale.z,
					duration: CONFIG.animation.duration,
					ease: 'power3.inOut',
				},
				0
			);
	}

	// Separate wipe animation function
	export function startWipeAnimation() {
		if (!sliderMesh) return;

		const timeline = gsap.timeline();
		timeline.to(sliderMesh.position, {
			x: sliderMaxX,
			duration: CONFIG.animation.duration * 0.8,
			ease: 'power2.inOut',
			onUpdate: () => {
				const progress = calculateWipeProgress(sliderMesh.position.x);
				dispatch('wipe', { progress });
			},
		});
	}

	// Handle mousewheel event
	function handleWheel(event) {
		if (!model || !isVisible) return;

		event.preventDefault();

		// Calculate target scale based on wheel direction
		const wheelDelta = event.deltaY;
		const scaleFactor = wheelDelta > 0 ? 1 : 1.6; // Scale between 1.25x and 2x (1.25 * 1.6)
		const targetScale = CONFIG.model.final.scale.x * scaleFactor;

		// Animate to target scale
		gsap.to(model.scale, {
			x: targetScale,
			y: targetScale,
			z: targetScale,
			duration: 0.5,
			ease: 'power2.out',
		});
	}

	onMount(async () => {
		await initThreeJS();
		window.addEventListener('resize', handleResize);
		window.addEventListener('mousedown', handleMouseDown);
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);

		return () => {
			// Clean up event listeners
			window.removeEventListener('mousedown', handleMouseDown);
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
			window.removeEventListener('wheel', handlePostTransitionScroll);
		};
	});

	onDestroy(() => {
		if (scrollAnimation) scrollAnimation.kill();
		if (scrollTimeout) clearTimeout(scrollTimeout);
	});
</script>

<div class="three-container" class:visible={isVisible} on:wheel={handleWheel}>
	<div bind:this={container}></div>
</div>

<style>
	.three-container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.three-container.visible {
		opacity: 1;
	}
</style>
