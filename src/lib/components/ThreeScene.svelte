<script>
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { gsap } from 'gsap';

	let container;
	let scene;
	let camera;
	let renderer;
	let model;
	let mixer;
	let modelLoaded = false;
	let animationFrameId;
	let screenMesh;

	// Configuration object for easy tweaking
	const CONFIG = {
		model: {
			initial: {
				scale: { x: 3, y: 3, z: 3 },
				position: { x: 0, y: 2, z: 0 },
				rotation: { x: -Math.PI / 6, y: 0, z: 0 }, // -30 degrees
			},
			final: {
				scale: { x: 1.5, y: 1.5, z: 1.5 },
				position: { x: 0, y: 0.2, z: 0.2 }, // Adjusted position to be more centered and forward
				rotation: { x: -Math.PI / 36, y: 0, z: 0 }, // Reduced to about 5 degrees for very slight tilt
			},
		},
		animation: {
			fadeIn: {
				duration: 1.5,
				ease: 'power2.inOut',
			},
			rotation: {
				duration: 2,
				ease: 'power2.inOut',
				fullRotations: 1, // Number of full Y-axis rotations
			},
			scale: {
				duration: 2,
				ease: 'power2.inOut',
			},
			position: {
				duration: 2,
				ease: 'power2.inOut',
			},
		},
		subtleRotation: {
			speed: 0.005,
			enabled: true,
		},
		camera: {
			fov: 75,
			position: {
				x: 0,
				y: 0,
				z: 5 // Move camera back to see model
			}
		},
		lighting: {
			ambient: {
				color: 0xffffff,
				intensity: 0.5,
			},
			directional: {
				color: 0xffffff,
				intensity: 0.8,
				position: { x: 1, y: 1, z: 1 },
			},
		},
	};

	// Animation state
	let isTransitioning = false;

	// Handle canvas ready event
	export function handleCanvasReady(canvas) {
		if (!scene || !modelLoaded || !screenMesh) return;

		// Create canvas texture
		const texture = new THREE.CanvasTexture(canvas);
		texture.needsUpdate = true;

		// Update screen material
		screenMesh.material = new THREE.MeshStandardMaterial({
			map: texture,
			roughness: 0.5,
			metalness: 0.1,
			transparent: true,
			opacity: 1
		});

		// Function to update texture
		function updateTexture() {
			if (texture) {
				texture.needsUpdate = true;
				requestAnimationFrame(updateTexture);
			}
		}
		updateTexture();
	}

	export function startTransition() {
		if (!modelLoaded) return;
		isTransitioning = true;

		// Animation sequence
		const timeline = gsap.timeline();

		// Fade in while rotating and scaling down
		timeline
			.to(container, {
				opacity: 1,
				duration: CONFIG.animation.fadeIn.duration,
				ease: CONFIG.animation.fadeIn.ease,
			})
			.to(
				model.rotation,
				{
					x: CONFIG.model.final.rotation.x,
					y:
						model.rotation.y +
						Math.PI * 2 * CONFIG.animation.rotation.fullRotations,
					z: CONFIG.model.final.rotation.z,
					duration: CONFIG.animation.rotation.duration,
					ease: CONFIG.animation.rotation.ease,
				},
				0
			)
			.to(
				model.scale,
				{
					x: CONFIG.model.final.scale.x,
					y: CONFIG.model.final.scale.y,
					z: CONFIG.model.final.scale.z,
					duration: CONFIG.animation.scale.duration,
					ease: CONFIG.animation.scale.ease,
				},
				0
			)
			.to(
				model.position,
				{
					x: CONFIG.model.final.position.x,
					y: CONFIG.model.final.position.y,
					z: CONFIG.model.final.position.z,
					duration: CONFIG.animation.position.duration,
					ease: CONFIG.animation.position.ease,
				},
				0
			);
	}

	onMount(async () => {
		// Scene setup
		scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera(
			CONFIG.camera.fov,
			window.innerWidth / window.innerHeight,
			0.1,
			1000
		);
		renderer = new THREE.WebGLRenderer({
			alpha: true,
			antialias: true,
		});

		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		container.appendChild(renderer.domElement);

		// Set initial camera position
		camera.position.set(
			CONFIG.camera.position.x,
			CONFIG.camera.position.y,
			CONFIG.camera.position.z
		);
		console.log('Camera position:', camera.position);

		// Lighting
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

		// Load model
		const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
		const loader = new GLTFLoader();
		try {
			console.log('Loading model...');
			const modelPath = new URL('../3d/MagnaSketch_3dModel.gltf', import.meta.url).href;
			console.log('Model path:', modelPath);
			const gltf = await loader.loadAsync(modelPath);
			console.log('Model loaded:', gltf);
			model = gltf.scene;

			// Find screen mesh
			model.traverse((child) => {
				if (child.name === 'Screen') {
					console.log('Found screen mesh:', child);
					screenMesh = child;
					// Log its material and texture info
					console.log('Material:', child.material);
					if (child.material && child.material.map) {
						console.log('Current texture:', child.material.map);
					}
				}
			});

			// Set initial model properties
			model.scale.set(
				CONFIG.model.initial.scale.x,
				CONFIG.model.initial.scale.y,
				CONFIG.model.initial.scale.z
			);
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
			scene.add(model);

			// Setup animations if they exist
			if (gltf.animations && gltf.animations.length) {
				mixer = new THREE.AnimationMixer(model);
				const action = mixer.clipAction(gltf.animations[0]);
				action.play();
			}

			modelLoaded = true;

			// Start subtle rotation animation
			const subtleRotate = () => {
				if (model && !isTransitioning && CONFIG.subtleRotation.enabled) {
					model.rotation.y += CONFIG.subtleRotation.speed;
					model.rotation.x = CONFIG.model.initial.rotation.x;
				}
			};

			// Animation loop
			const clock = new THREE.Clock();
			const animate = () => {
				animationFrameId = requestAnimationFrame(animate);

				if (mixer) {
					mixer.update(clock.getDelta());
				}

				subtleRotate();
				renderer.render(scene, camera);
			};
			animate();
		} catch (error) {
			console.error('Error loading model:', error);
			console.error('Error details:', {
				message: error.message,
				stack: error.stack
			});
		}

		// Handle window resize
		const handleResize = () => {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth, window.innerHeight);
		};
		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId);
			}
			if (renderer) {
				renderer.dispose();
			}
		};
	});

	onDestroy(() => {
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
		}
		if (scene) {
			// Dispose of geometries and materials
			scene.traverse((object) => {
				if (object.geometry) {
					object.geometry.dispose();
				}
				if (object.material) {
					if (Array.isArray(object.material)) {
						object.material.forEach(material => material.dispose());
					} else {
						object.material.dispose();
					}
				}
			});
			scene.clear();
		}
		if (renderer) {
			renderer.dispose();
		}
	});
</script>

<div
	bind:this={container}
	class="three-container"
	class:transitioning={isTransitioning}
></div>

<style>
	.three-container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: -1;
	}

	.three-container.transitioning {
		pointer-events: none;
	}
</style>
