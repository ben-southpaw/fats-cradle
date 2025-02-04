<script>
	import { onMount, createEventDispatcher } from 'svelte';
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
				}
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
	const dispatch = createEventDispatcher();

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

	// Create a raycaster for slider interaction
	const raycaster = new THREE.Raycaster();
	const mouse = new THREE.Vector2();

	// Calculate normalized progress (0 to 1) based on slider position
	function calculateWipeProgress(x) {
		// Invert the progress since we want to clear from left to right
		return 1 - ((x - sliderMinX) / (sliderMaxX - sliderMinX));
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
				duration: CONFIG.animation.delay + 0.2, // Shorter delay for quicker start
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
				// Remove wheel listener after transition
				window.removeEventListener('wheel', handleWheel);
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

		// Add slider animation
		if (sliderMesh) {
			timeline.to(
				sliderMesh.position,
				{
					x: sliderMaxX,
					duration: CONFIG.animation.duration * 0.8, // Slightly faster than main animation
					delay: CONFIG.animation.wipeDelay, // Start after wipe delay
					ease: 'power2.inOut',
					onUpdate: () => {
						const progress = calculateWipeProgress(sliderMesh.position.x);
						dispatch('wipe', { progress });
					},
				},
				0 // Start at beginning of timeline
			);
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
		CONFIG.lighting.pointLights.forEach(light => {
			const pointLight = new THREE.PointLight(light.color, light.intensity);
			pointLight.position.set(light.position.x, light.position.y, light.position.z);
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
		loader.resourcePath = '/models/';  // Set resource path for textures and other assets
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
						if (child.material.roughnessMap && !child.material.roughnessMap.image) {
							child.material.roughnessMap = null;
						}
						if (child.material.metalnessMap && !child.material.metalnessMap.image) {
							child.material.metalnessMap = null;
						}

						// Special handling for the white text
						if (child.name === 'Curve003_1') {
							child.material.roughness = 0.2;  // Very smooth for more reflection
							child.material.metalness = 0.1;  // Minimal metalness for cleaner white
							child.material.emissive = new THREE.Color(0xffffff);  // Add white glow
							child.material.emissiveIntensity = 0.2;  // Subtle glow
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
			logoLight.position.set(3, 4, 1);  // Moved further top-right (x: right, y: up, z: forward)
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
			model.scale.set(
				screenScale.x,
				screenScale.y,
				screenScale.z
			);

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

	function handleMouseDown(event) {
		if (!sliderMesh) return;

		// Convert mouse position to normalized device coordinates
		mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
		mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

		// Update the picking ray with the camera and mouse position
		raycaster.setFromCamera(mouse, camera);

		// Check if we clicked on the slider
		const intersects = raycaster.intersectObject(sliderMesh, true);
		if (intersects.length > 0) {
			isSliderDragging = true;
			sliderStartX = event.clientX;
		}
	}

	function handleMouseMove(event) {
		if (!isSliderDragging || !sliderMesh) return;

		// Calculate movement (adjusted sensitivity)
		const movement = (event.clientX - sliderStartX) * 0.003; // Reduced sensitivity for more control
		const newX = sliderMesh.position.x + movement;

		// Clamp to bounds
		const clampedX = Math.min(Math.max(newX, sliderMinX), sliderMaxX);
		sliderMesh.position.x = clampedX;

		// Calculate normalized position (0 to 1)
		const normalizedPosition = calculateWipeProgress(clampedX);

		// Update start position for next frame
		sliderStartX = event.clientX;

		// Emit wipe progress event
		dispatch('wipe', { progress: normalizedPosition });
	}

	function handleMouseUp() {
		isSliderDragging = false;
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
			ease: "power2.out"
		});
	}

	onMount(async () => {
		await initThreeJS();
		window.addEventListener('resize', handleResize);
		window.addEventListener('mousedown', handleMouseDown);
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
		window.addEventListener('wheel', handleWheel);
		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('mousedown', handleMouseDown);
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
			window.removeEventListener('wheel', handleWheel);
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId);
			}
		};
	});
</script>

<div
	class="three-container"
	class:visible={isVisible}
	on:wheel={handleWheel}
>
	<div bind:this={container} />
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
