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
			path: '/models/MagnaSketch_3dModel.gltf',  // Use absolute path from root for live deployment
			initial: {
				position: { x: 0, y: 0, z: -2 },
				rotation: { x: 0, y: 0, z: 0 },
				scale: { x: 2.25, y: 2.25, z: 2.25 }, // Start at 2.25
			},
			final: {
				position: { x: 0, y: 0, z: -2 },
				rotation: { x: 0, y: Math.PI * 2, z: 0 }, // Full 360 rotation
				scale: { x: 1.25, y: 1.25, z: 1.25 }, // End at 1.25
			},
		},
		camera: {
			fov: 45,
			near: 0.1,
			far: 800,
			position: { x: 0, y: 0, z: 5 },
		},
		lighting: {
			ambient: {
				color: 0xffffff,
				intensity: 0.5,
			},
			directional: {
				color: 0xffffff,
				intensity: 0.8,
				position: { x: 5, y: 5, z: 5 },
			},
		},
		animation: {
			duration: 2.3,
			delay: 0.4, // Shorter initial delay
			sliderDelay: 0.8, // Delay before slider starts
			sliderDuration: 2.0, // Slower slider movement
			snapBackDelay: 0, // Immediate snap back
			snapBackDuration: 0.2, // Faster snap back
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
		return (x - sliderMinX) / (sliderMaxX - sliderMinX);
	}

	export function startTransition() {
		if (!modelLoaded || !model || isTransitioning) return;

		isTransitioning = true;
		dispatch('transitionstart');

		// Ensure clipping planes are set up before animation
		setupClippingPlanes();

		// Animation sequence
		const timeline = gsap.timeline({
			delay: CONFIG.animation.delay,
			onComplete: () => {
				isTransitioning = false;
			},
		});

		// Start invisible and show after scroll animation + delay
		isVisible = false;
		gsap.to(
			{},
			{
				duration: CONFIG.animation.delay + 0.5, // Add extra time for scroll animation
				onComplete: () => {
					isVisible = true;
					dispatch('transitioncomplete'); // Trigger canvas fade when model appears
				},
			}
		);

		// Start from initial state
		model.scale.set(
			CONFIG.model.initial.scale.x,
			CONFIG.model.initial.scale.y,
			CONFIG.model.initial.scale.z
		);
		model.rotation.set(
			CONFIG.model.initial.rotation.x,
			CONFIG.model.initial.rotation.y,
			CONFIG.model.initial.rotation.z
		);

		// Move slider to start position instantly
		if (sliderMesh) {
			sliderMesh.position.x = sliderMinX;
		}

		// Animate scale down and rotate
		timeline
			.to(model.rotation, {
				y: CONFIG.model.final.rotation.y,
				duration: CONFIG.animation.duration,
				ease: 'power3.inOut',
			})
			.to(
				model.scale,
				{
					x: CONFIG.model.final.scale.x,
					y: CONFIG.model.final.scale.y,
					z: CONFIG.model.final.scale.z,
					duration: CONFIG.animation.duration,
					ease: 'expo.out',
				},
				0
			);

		// Add slider animation to run during the rotation
		if (sliderMesh) {
			timeline
				.to(
					sliderMesh.position,
					{
						x: sliderMaxX,
						duration: CONFIG.animation.sliderDuration,
						ease: 'power2.inOut', // Smooth movement to right
						onUpdate: () => {
							const progress = calculateWipeProgress(sliderMesh.position.x);
							dispatch('wipe', { progress });
						},
					},
					CONFIG.animation.sliderDelay
				)
				.to(
					sliderMesh.position,
					{
						x: sliderMinX,
						duration: CONFIG.animation.snapBackDuration,
						ease: 'power1.in', // Snappy movement back
						onStart: () => {
							dispatch('snapbackstart');
						},
						onUpdate: () => {
							const progress = calculateWipeProgress(sliderMesh.position.x);
							dispatch('wipe', { progress });
						},
					},
					'>' // Start immediately after previous animation
				);
		}
	}

	async function loadModel() {
		const loader = new GLTFLoader();
		loader.resourcePath = '/models/';  // Set resource path for textures and other assets
		try {
			const gltf = await loader.loadAsync(CONFIG.model.path);
			model = gltf.scene;

			// Handle materials to prevent texture loading errors
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
					}
				}
			});

			// Apply initial transforms
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

			// Set initial scale but keep invisible
			model.scale.set(
				CONFIG.model.initial.scale.x,
				CONFIG.model.initial.scale.y,
				CONFIG.model.initial.scale.z
			);
			isVisible = false; // Start invisible

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
					// Store initial position for reset
					sliderInitialPosition = child.position.clone();

					// Set slider bounds to 90% of rail width (-1.63 to 1.63)
					// This should only hide about 20% of the knob width on each end
					sliderMinX = -1.47; // 90% of -1.63
					sliderMaxX = 1.47; // 90% of 1.63

					// Move slider to left end initially
					sliderMesh.position.x = sliderMinX;
				} else if (child.name === 'Curve' || child.name === 'Curve_1') {
					// Log rail position if found
					const box = new THREE.Box3().setFromObject(child);
					// Only log in development
					if (import.meta.env.DEV) {
						// console.debug('Rail bounds:', child.name, box.min.x, box.max.x);
					}
				}
			});

			if (!foundScreen) {
				console.warn('No screen mesh found in model');
			}

			scene.add(model);
			modelLoaded = true;
		} catch (error) {
			console.error('Error loading model:', error);
		}
	}

	async function initThreeJS() {
		scene = new THREE.Scene();

		// Add lighting
		const ambientLight = new THREE.AmbientLight(
			CONFIG.lighting.ambient.color,
			CONFIG.lighting.ambient.intensity
		);
		scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(
			CONFIG.lighting.directional.color,
			CONFIG.lighting.directional.intensity
		);
		directionalLight.position.set(
			CONFIG.lighting.directional.position.x,
			CONFIG.lighting.directional.position.y,
			CONFIG.lighting.directional.position.z
		);
		scene.add(directionalLight);

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
		container.appendChild(renderer.domElement);

		await loadModel();

		// Start render loop
		animate();
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

	onMount(async () => {
		await initThreeJS();
		window.addEventListener('resize', handleResize);
		window.addEventListener('mousedown', handleMouseDown);
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('mousedown', handleMouseDown);
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId);
			}
		};
	});
</script>

<div
	class="three-container"
	class:visible={isVisible}
	bind:this={container}
></div>

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
