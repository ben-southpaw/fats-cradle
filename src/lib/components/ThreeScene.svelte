<script>
	import { onMount, createEventDispatcher } from 'svelte';
	import * as THREE from 'three';
	import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
	import gsap from 'gsap';
	import modelUrl from '../3d/MagnaSketch_3dModel.gltf?url';

	export let canvas; // Accept canvas from parent
	export let onCanvasReady = undefined;
	export let onCanvasClick = undefined;

	let container;
	let scene;
	let camera;
	let renderer;
	let model;
	let screenMesh;
	let isVisible = false;
	let modelLoaded = false;
	let animationFrameId;
	let canvasTexture;

	$: if (canvas && screenMesh?.material?.map) {
		// Update texture when canvas changes
		screenMesh.material.map.needsUpdate = true;
	}

	const CONFIG = {
		model: {
			path: modelUrl,
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
		},
	};

	let isTransitioning = false;
	const dispatch = createEventDispatcher();

	export function startTransition() {
		if (!modelLoaded || !model || isTransitioning) return;

		isTransitioning = true;
		isVisible = true;
		dispatch('transitionstart');

		// Animation sequence
		const timeline = gsap.timeline({
			onComplete: () => {
				isTransitioning = false;
				dispatch('transitioncomplete');
			},
		});

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
	}

	async function initThreeJS() {
		console.log('Initializing Three.js scene...');
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

		// Create canvas texture
		canvasTexture = new THREE.CanvasTexture(canvas);
		canvasTexture.minFilter = THREE.LinearFilter;
		canvasTexture.magFilter = THREE.LinearFilter;
		canvasTexture.generateMipmaps = false;
		canvasTexture.encoding = THREE.sRGBEncoding;
		canvasTexture.needsUpdate = true;
		canvasTexture.flipY = true;
		canvasTexture.repeat.set(-1, 1);
		canvasTexture.offset.set(1, 0);

		// Load 3D model
		console.log('Loading model from:', modelUrl);
		const loader = new GLTFLoader();

		try {
			const gltf = await new Promise((resolve, reject) => {
				loader.load(
					modelUrl,
					resolve,
					(progress) => console.log('Loading progress:', progress),
					reject
				);
			});

			console.log('Model loaded successfully');
			model = gltf.scene;

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

			// Find screen mesh
			let foundScreen = false;
			model.traverse((child) => {
				console.log('Traversing model child:', child.name);
				if (child.name === 'Screen') {
					console.log('Found screen mesh');
					foundScreen = true;
					screenMesh = child;

					// Create material with canvas texture
					if (screenMesh.material) {
						screenMesh.material.dispose();
					}

					screenMesh.material = new THREE.MeshBasicMaterial({
						map: canvasTexture,
						transparent: true,
						opacity: 1,
						side: THREE.DoubleSide,
						toneMapped: false,
					});

					// Fix UV mapping to correct mirroring and rotation
					if (screenMesh.geometry) {
						// Reset UV coordinates to original
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
					}
				}
			});

			if (!foundScreen) {
				console.warn('No screen mesh found in model');
			}

			scene.add(model);
			console.log('Added model to scene');
			modelLoaded = true;

			// Start render loop
			animate();
		} catch (error) {
			console.error('Error loading model:', error);
			console.error('Error details:', error.message);
		}
	}

	function animate() {
		if (!modelLoaded) return;

		requestAnimationFrame(animate);

		// Update canvas texture if it exists
		if (canvasTexture) {
			canvasTexture.needsUpdate = true;
		}

		renderer.render(scene, camera);
	}

	function handleResize() {
		if (!camera || !renderer) return;

		const width = window.innerWidth;
		const height = window.innerHeight;

		camera.aspect = width / height;
		camera.updateProjectionMatrix();

		renderer.setSize(width, height);
	}

	onMount(async () => {
		console.log('Component mounted');
		await initThreeJS();
		console.log('Three.js initialized');

		// Handle window resize
		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
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
