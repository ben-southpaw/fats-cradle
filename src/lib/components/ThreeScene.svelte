<script>
	import { onMount, createEventDispatcher, onDestroy, tick } from 'svelte';
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
			canvasTexture.colorSpace = THREE.SRGBColorSpace;
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
			path: '/models/MagnaSketch_3dModel.glb',
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
				intensity: 0.3, // Reduced for stronger shadows
			},
			hemisphere: {
				skyColor: 0xffffff,
				groundColor: 0x444444,
				intensity: 0.5,
			},
			directional: {
				color: 0xffffff,
				intensity: 1.4,
				position: { x: 1, y: 2, z: 3 },
				shadow: {
					mapSize: { width: 2048, height: 2048 },
					camera: {
						near: 0.5,
						far: 20,
						left: -5,
						right: 5,
						top: 5,
						bottom: -5,
					},
				},
			},
			rimLight: {
				color: 0xffffff,
				intensity: 0.4,
				position: { x: -2, y: 0.5, z: -1 },
			},
			ground: {
				color: 0x444444,
				size: 200,
				position: { y: 0 },
			},
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
	let hasReceivedSecondWheelEvent = false; // Track if we've received a second wheel event
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
				duration: 0.5,
				ease: 'power3.out',
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
			emitEndAnimationEvent();
			window.removeEventListener('wheel', handlePostTransitionScroll);
		}
	}

	function emitEndAnimationEvent() {
		const message = {
			type: 'animationComplete',
		};
		//update to live link later
		window.parent.postMessage(
			message,
			'https://my.readymag.com/edit/5177230/preview/'
		);
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

		// If this is the first wheel event after the initial animation,
		// trigger the full spin and wipe to the end
		if (!hasReceivedSecondWheelEvent) {
			hasReceivedSecondWheelEvent = true;

			// Remove the wheel event listener since we only need it once
			window.removeEventListener('wheel', handlePostTransitionScroll);

			// Perform the full spin and complete wipe to the end
			performFullSpinAndWipe();
			return;
		}

		// This code should not be reached since we remove the listener after the first event,
		// but keeping it for safety
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

			// Convert to world position
			const worldX =
				sliderMinX + (sliderMaxX - sliderMinX) * currentSliderPosition;

			// Update slider position
			updateSliderPosition(worldX, false);
		}, 16); // ~60fps timing
	}

	// Function to perform a complete spin and wipe to the end
	function performFullSpinAndWipe() {
		if (!sliderMesh || !model) return;

		// Kill any existing animations
		if (scrollAnimation) scrollAnimation.kill();

		// Create a timeline for the sequence
		const timeline = gsap.timeline({
			onComplete: () => {
				// After animation completes, update the state
				currentSliderPosition = 1;
				totalScrollAmount = 1;
				emitEndAnimationEvent();
			},
		});

		// First, perform a quick spin animation on the model
		timeline.to(model.rotation, {
			y: model.rotation.y + Math.PI * 2, // Full 360-degree spin
			duration: 0.8, // Fast spin
			ease: 'power2.inOut',
		});

		// Then, perform the complete wipe animation to the end, but only after the spin is complete
		timeline.to(
			sliderMesh.position,
			{
				x: sliderMaxX, // Go all the way to the end
				duration: 1.2,
				ease: 'power3.out',
				onUpdate: () => {
					// Calculate and dispatch progress during animation
					const progress = calculateWipeProgress(sliderMesh.position.x);
					dispatch('wipe', { progress });
				},
			},
			'>'
		);

		// Store the animation for potential cancellation
		scrollAnimation = timeline;
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

		// Use original mesh aspect ratio
		const meshAspect = meshWidth / meshHeight;

		// Keep original proportions
		const heightScale = 1.0;
		const widthScale = 1.0; // Maintain original width-to-height ratio

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
			color: new THREE.Color('#F2F2F2'), // Match canvas background color
			// Color space is handled by the renderer's outputEncoding
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

		// Configure renderer for shadows
		renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true,
		});
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		// Add ground plane for shadows
		const groundGeometry = new THREE.PlaneGeometry(
			CONFIG.lighting.ground.size,
			CONFIG.lighting.ground.size
		);
		const groundMaterial = new THREE.ShadowMaterial({
			opacity: 0.9,
		});
		const ground = new THREE.Mesh(groundGeometry, groundMaterial);
		ground.rotation.x = -Math.PI / 2;
		ground.position.y = CONFIG.lighting.ground.position.y;
		ground.receiveShadow = true;
		scene.add(ground);

		// Add hemisphere light
		const hemiLight = new THREE.HemisphereLight(
			CONFIG.lighting.hemisphere.skyColor,
			CONFIG.lighting.hemisphere.groundColor,
			CONFIG.lighting.hemisphere.intensity
		);
		scene.add(hemiLight);

		// Add ambient light
		const ambientLight = new THREE.AmbientLight(
			CONFIG.lighting.ambient.color,
			CONFIG.lighting.ambient.intensity
		);
		scene.add(ambientLight);

		// Add main directional light with shadows
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

		// Configure shadow properties
		directionalLight.shadow.mapSize.width =
			CONFIG.lighting.directional.shadow.mapSize.width;
		directionalLight.shadow.mapSize.height =
			CONFIG.lighting.directional.shadow.mapSize.height;
		directionalLight.shadow.camera.near =
			CONFIG.lighting.directional.shadow.camera.near;
		directionalLight.shadow.camera.far =
			CONFIG.lighting.directional.shadow.camera.far;
		directionalLight.shadow.camera.left =
			CONFIG.lighting.directional.shadow.camera.left;
		directionalLight.shadow.camera.right =
			CONFIG.lighting.directional.shadow.camera.right;
		directionalLight.shadow.camera.top =
			CONFIG.lighting.directional.shadow.camera.top;
		directionalLight.shadow.camera.bottom =
			CONFIG.lighting.directional.shadow.camera.bottom;
		directionalLight.shadow.bias = -0.0001;
		scene.add(directionalLight);

		// Add rim light
		const rimLight = new THREE.DirectionalLight(
			CONFIG.lighting.rimLight.color,
			CONFIG.lighting.rimLight.intensity
		);
		rimLight.position.set(
			CONFIG.lighting.rimLight.position.x,
			CONFIG.lighting.rimLight.position.y,
			CONFIG.lighting.rimLight.position.z
		);
		scene.add(rimLight);

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

		// Use container dimensions instead of window
		const containerWidth = container.clientWidth;
		const containerHeight = container.clientHeight;

		// Set size based on container
		renderer.setSize(containerWidth, containerHeight, false); // false prevents setting canvas style
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.outputEncoding = THREE.sRGBEncoding;
		renderer.toneMapping = THREE.ACESFilmicToneMapping; // More natural color reproduction
		renderer.toneMappingExposure = 1.0; // Balanced exposure

		// Update camera aspect ratio to match container
		camera.aspect = containerWidth / containerHeight;
		camera.updateProjectionMatrix();

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
					child.castShadow = true;
					child.receiveShadow = true;

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

						// Check if this is a magnet by looking at material color and name
						const color = child.material.color;
						const isMagnet =
							(color.r !== 1 || color.g !== 1 || color.b !== 1) &&
							child.name.startsWith('Curve') &&
							!child.name.includes('003'); // Exclude logo (Curve003)

						if (isMagnet) {
							// Create a new material for each magnet to prevent sharing
							child.material = new THREE.MeshStandardMaterial({
								color: child.material.color,
								roughness: 0.2,
								metalness: 0.0,
								emissive: child.material.color,
								emissiveIntensity: 0.2,
								transparent: false,
								depthTest: true,
								depthWrite: true,
								side: THREE.FrontSide,
							});

							// Ensure proper positioning
							if (
								child.position.x === 0 &&
								child.position.y === 0 &&
								child.position.z === 0
							) {
								// Move slightly forward to prevent z-fighting
								child.position.z += 0.01 * Math.random(); // Random small offset
							}

							// Boost the color saturation and brightness
							const hsl = {};
							color.getHSL(hsl);
							color.setHSL(
								hsl.h,
								Math.min(1, hsl.s * 1.4),
								Math.min(0.7, hsl.l * 1.3)
							);
						} else if (child.name === 'Screen_Border') {
							// Special handling for the screen border
							child.material.roughness = 0.5; // Duller surface
							child.material.metalness = 0.1; // Less metallic/shiny
							child.material.emissive = child.material.color; // Add glow
							child.material.emissiveIntensity = 0.3; // Moderate glow
						} else if (child.name === 'Slider') {
							// Special handling for the slider knob
							child.material.roughness = 0.8; // Slightly glossy
							child.material.metalness = 0.3; // More metallic
							child.material.emissive = child.material.color; // Add glow
							child.material.emissiveIntensity = 0.4; // Subtle glow
						} else if (child.name === 'Curve003_1') {
							// Special handling for the white text
							child.material.roughness = 0.3; // Lower roughness for more specular highlights
							child.material.metalness = 0.2; // Slightly more metallic for better light reflection
							child.material.emissive = new THREE.Color(0xffffff);
							child.material.emissiveIntensity = 0.4;
							child.material.shadowSide = THREE.FrontSide; // Ensure shadows are cast properly
							child.castShadow = true; // Ensure it casts shadows
							child.receiveShadow = true; // Ensure it receives shadows
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
			scene.add(logoLight);

			// Add bottom-right light mirroring the top-right light
			const bottomLight = new THREE.PointLight(0xffffff, 2.0); // Further increased intensity
			bottomLight.position.set(2, -4, 1.5); // Moved slightly left and forward
			scene.add(bottomLight);

			// Add a direct light specifically for the Curve003_1 (white text) element
			const textLight = new THREE.SpotLight(0xffffff, 1.5);
			textLight.position.set(0, 0, 3); // Position in front of the model
			textLight.angle = Math.PI / 8; // Narrow angle for focused light (~22.5 degrees)
			textLight.penumbra = 0.5; // Soft edges
			textLight.decay = 1.5; // Faster decay for more dramatic shadows
			textLight.distance = 10; // Reasonable range
			textLight.castShadow = true; // Enable shadow casting

			// Configure shadow quality for the text light
			textLight.shadow.mapSize.width = 512;
			textLight.shadow.mapSize.height = 512;
			textLight.shadow.camera.near = 0.5;
			textLight.shadow.camera.far = 15;
			textLight.shadow.bias = -0.0005;

			// Target the light at the text area (slightly above center)
			textLight.target.position.set(0, 0.5, 0);
			scene.add(textLight);
			scene.add(textLight.target);

			// Add right spotlight for focused bottom border illumination
			const rightSpotLight = new THREE.SpotLight(0xffffff, 3.0); // Much higher intensity
			rightSpotLight.position.set(2, -2.7, 1.5); // Raised position by ~10%
			rightSpotLight.angle = Math.PI / 3.5; // Even wider angle (~51 degrees)
			rightSpotLight.penumbra = 0.7; // Even softer edges
			rightSpotLight.decay = 0.8; // Less decay for more reach
			rightSpotLight.distance = 12; // Increased range
			rightSpotLight.target.position.set(0, -0.9, 0); // Target also raised slightly
			scene.add(rightSpotLight);
			scene.add(rightSpotLight.target);

			// Add left spotlight mirroring the right one
			const leftSpotLight = new THREE.SpotLight(0xffffff, 3.0);
			leftSpotLight.position.set(-2, -2.7, 1.5); // Mirror of right spotlight
			leftSpotLight.angle = Math.PI / 3.5;
			leftSpotLight.penumbra = 0.7;
			leftSpotLight.decay = 0.8;
			leftSpotLight.distance = 12;
			leftSpotLight.target.position.set(0, -0.9, 0); // Same target as right spotlight
			scene.add(leftSpotLight);
			scene.add(leftSpotLight.target);

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
		// Reset the second wheel event flag
		hasReceivedSecondWheelEvent = false;

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

		// First do a spin animation, then the wipe
		const timeline = gsap.timeline();

		// Add a spin animation if the model exists
		if (model) {
			timeline.to(model.rotation, {
				y: model.rotation.y + Math.PI * 2, // Full 360-degree spin
				duration: CONFIG.animation.duration * 0.4, // Fast spin
				ease: 'power2.inOut',
			});
		}

		// Then do the wipe animation
		timeline.to(
			sliderMesh.position,
			{
				x: sliderMaxX,
				duration: CONFIG.animation.duration * 0.6,
				ease: 'power2.inOut',
				onUpdate: () => {
					const progress = calculateWipeProgress(sliderMesh.position.x);
					dispatch('wipe', { progress });
				},
			},
			model ? 0.2 : 0
		); // Slight overlap with spin if model exists
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
		// Wait for next tick to ensure container is mounted and sized
		await tick();

		// Initialize Three.js scene and setup
		await initThreeJS();

		// Set up ResizeObserver for container
		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				// Get current dimensions, accounting for any style changes
				const width = container.clientWidth;
				const height = container.clientHeight;

				// Update only if dimensions actually changed
				if (
					width !== entry.contentRect.width ||
					height !== entry.contentRect.height
				) {
					handleResize(width, height);
				}
			}
		});

		if (container) {
			resizeObserver.observe(container);
			// Initial size update using container dimensions
			handleResize(container.clientWidth, container.clientHeight);
		}

		// Add event listeners
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
	/* Force canvas to match container size */
	:global(.three-container canvas) {
		width: 100% !important;
		height: 100% !important;
		display: block;
	}
</style>
