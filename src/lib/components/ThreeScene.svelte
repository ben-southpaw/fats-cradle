<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import * as THREE from 'three';
	import { gsap } from 'gsap';

	let container;
	let canvas;
	let scene;
	let camera;
	let renderer;
	let model;
	let mixer;
	let isTransitioning = false;
	let isVisible = false;
	let modelLoaded = false;
	let animationFrameId;
	let screenMesh;
	let canvasTexture;
	let CONFIG = {
		model: {
			initial: {
				rotation: {
					x: 0,
					y: 0,
					z: 0,
				},
				scale: {
					x: 2.5,
					y: 2.5,
					z: 2.5,
				},
				position: {
					x: 0,
					y: 0.5,
					z: 0,
				},
			},
			final: {
				rotation: {
					x: 0,
					y: 0,
					z: 0,
				},
				scale: {
					x: 0.8,
					y: 0.8,
					z: 0.8,
				},
				position: {
					x: 0,
					y: 0.2,
					z: 0,
				},
			},
		},
		camera: {
			fov: 35,
			near: 0.1,
			far: 800,
			initial: {
				position: {
					x: 0,
					y: 0,
					z: 6.5,
				},
			},
		},
		animation: {
			fadeIn: {
				duration: 1.5,
				ease: 'power2.inOut',
				delay: 0.5,
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

	const dispatch = createEventDispatcher();

	export function startTransition() {
		if (!modelLoaded || !model) return;
		isTransitioning = true;
		isVisible = true;
		dispatchEvent(new CustomEvent('transitionstart'));

		// Animation sequence
		const timeline = gsap.timeline({ delay: CONFIG.animation.fadeIn.delay });

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

	// Handle canvas ready event
	export function handleCanvasReady(canvasElement) {
		if (!canvasElement || !screenMesh) return;

		// Wait for next frame to ensure canvas is initialized
		requestAnimationFrame(() => {
			if (canvasTexture) {
				canvasTexture.dispose();
			}

			canvasTexture = new THREE.CanvasTexture(canvasElement);
			canvasTexture.minFilter = THREE.LinearFilter;
			canvasTexture.magFilter = THREE.LinearFilter;
			canvasTexture.generateMipmaps = false;

			// Update screen material
			if (screenMesh.material) {
				screenMesh.material.dispose();
			}

			screenMesh.material = new THREE.MeshBasicMaterial({
				map: canvasTexture,
				transparent: true,
				opacity: 1,
			});
		});
	}

	onMount(async () => {
		// Scene setup
		scene = new THREE.Scene();
		const aspect = window.innerWidth / window.innerHeight;
		camera = new THREE.PerspectiveCamera(
			CONFIG.camera.fov,
			aspect,
			CONFIG.camera.near,
			CONFIG.camera.far
		);
		camera.lookAt(0, 0, 0);

		renderer = new THREE.WebGLRenderer({ 
			canvas,
			antialias: true, 
			alpha: true 
		});
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setPixelRatio(window.devicePixelRatio);

		// Set initial camera position
		camera.position.set(
			CONFIG.camera.initial.position.x,
			CONFIG.camera.initial.position.y,
			CONFIG.camera.initial.position.z
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
		const { GLTFLoader } = await import(
			'three/examples/jsm/loaders/GLTFLoader.js'
		);
		const loader = new GLTFLoader();
		try {
			console.log('Loading model...');
			const modelPath = new URL(
				'../3d/MagnaSketch_3dModel.gltf',
				import.meta.url
			).href;
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
				stack: error.stack,
			});
		}

		// Handle window resize
		function handleResize() {
			const width = window.innerWidth;
			const height = window.innerHeight;

			camera.aspect = width / height;
			camera.updateProjectionMatrix();

			renderer.setSize(width, height);
		}

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
						object.material.forEach((material) => material.dispose());
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
		if (canvasTexture) {
			canvasTexture.dispose();
		}
	});
</script>

<div 
	class="three-container"
	class:visible={isVisible}
	bind:this={container}
>
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.three-container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		z-index: 100;
		opacity: 0;
		transition: opacity 0.5s ease-out;
		pointer-events: none;
	}

	.three-container.visible {
		opacity: 1;
		pointer-events: auto;
	}

	canvas {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
