<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import * as THREE from 'three';
	import { gsap } from 'gsap';

	export let canvas; // This is the drawing canvas from Canvas.svelte

	let container;
	let renderCanvas;  // This canvas is for Three.js rendering only
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
	let renderTarget;

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
		dispatch('transitionstart');

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
		if (!canvasElement || !screenMesh) {
			console.log('Canvas or screen mesh not ready:', { canvas: !!canvasElement, screenMesh: !!screenMesh });
			return;
		}

		console.log('Handling canvas ready');

		// Wait for next frame to ensure canvas is initialized
		requestAnimationFrame(() => {
			if (canvasTexture) {
				canvasTexture.dispose();
			}
			if (renderTarget) {
				renderTarget.dispose();
			}

			// Create render target with same dimensions as canvas
			renderTarget = new THREE.WebGLRenderTarget(
				canvas.width,
				canvas.height,
				{
					minFilter: THREE.LinearFilter,
					magFilter: THREE.LinearFilter,
					format: THREE.RGBAFormat,
					encoding: THREE.sRGBEncoding,
					generateMipmaps: false
				}
			);

			// Create scene for rendering canvas
			const rtScene = new THREE.Scene();
			rtScene.background = new THREE.Color('hotpink');
			const rtCamera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);

			// Create temporary texture from canvas
			const tempTexture = new THREE.CanvasTexture(canvas);
			tempTexture.minFilter = THREE.LinearFilter;
			tempTexture.magFilter = THREE.LinearFilter;
			tempTexture.generateMipmaps = false;
			tempTexture.needsUpdate = true;
			tempTexture.encoding = THREE.sRGBEncoding;

			// Create plane for rendering canvas texture
			const rtGeometry = new THREE.PlaneGeometry(1, 1);
			// Flip UV coordinates
			const uvs = rtGeometry.attributes.uv;
			for (let i = 0; i < uvs.count; i++) {
				uvs.setY(i, 1 - uvs.getY(i));
			}
			const rtMaterial = new THREE.MeshBasicMaterial({
				map: tempTexture,
				transparent: true
			});
			const rtMesh = new THREE.Mesh(rtGeometry, rtMaterial);
			rtScene.add(rtMesh);

			// Render to target
			renderer.setClearColor('hotpink');
			renderer.setRenderTarget(renderTarget);
			renderer.clear();
			renderer.render(rtScene, rtCamera);
			renderer.setRenderTarget(null);
			renderer.setClearColor(0x000000, 0); // Reset to default

			// Clean up temporary objects
			rtGeometry.dispose();
			rtMaterial.dispose();
			tempTexture.dispose();

			// Use render target texture for screen mesh
			if (screenMesh.material) {
				screenMesh.material.dispose();
			}

			screenMesh.material = new THREE.MeshBasicMaterial({
				map: renderTarget.texture,
				transparent: true,
				opacity: 1,
				side: THREE.DoubleSide,
				toneMapped: false,
				color: new THREE.Color('#E8E8E8')
			});

			console.log('Updated screen mesh material with render target texture');
		});
	}

	function updateCanvasTexture() {
		if (!renderTarget || !canvas || !screenMesh || !screenMesh.material) return;

		// Update render target with new canvas content
		const rtScene = new THREE.Scene();
		rtScene.background = new THREE.Color('hotpink');
		const rtCamera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);

		const tempTexture = new THREE.CanvasTexture(canvas);
		tempTexture.minFilter = THREE.LinearFilter;
		tempTexture.magFilter = THREE.LinearFilter;
		tempTexture.generateMipmaps = false;
		tempTexture.needsUpdate = true;
		tempTexture.encoding = THREE.sRGBEncoding;

		const rtGeometry = new THREE.PlaneGeometry(1, 1);
		// Flip UV coordinates
		const uvs = rtGeometry.attributes.uv;
		for (let i = 0; i < uvs.count; i++) {
			uvs.setY(i, 1 - uvs.getY(i));
		}
		const rtMaterial = new THREE.MeshBasicMaterial({
			map: tempTexture,
			transparent: true
		});
		const rtMesh = new THREE.Mesh(rtGeometry, rtMaterial);
		rtScene.add(rtMesh);

		renderer.setClearColor('hotpink');
		renderer.setRenderTarget(renderTarget);
		renderer.clear();
		renderer.render(rtScene, rtCamera);
		renderer.setRenderTarget(null);
		renderer.setClearColor(0x000000, 0); // Reset to default

		// Clean up
		rtGeometry.dispose();
		rtMaterial.dispose();
		tempTexture.dispose();
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
			canvas: renderCanvas,
			antialias: true,
			alpha: true,
		});
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setPixelRatio(window.devicePixelRatio);

		// Set initial camera position
		camera.position.set(
			CONFIG.camera.initial.position.x,
			CONFIG.camera.initial.position.y,
			CONFIG.camera.initial.position.z
		);

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
			const modelPath = new URL(
				'../3d/MagnaSketch_3dModel.gltf',
				import.meta.url
			).href;
			const gltf = await loader.loadAsync(modelPath);
			model = gltf.scene;

			// Find screen mesh
			model.traverse((child) => {
				console.log('Traversing model child:', child.name);
				if (child.name === 'Screen') {
					console.log('Found screen mesh');
					screenMesh = child;

					// Set initial material
					screenMesh.material = new THREE.MeshBasicMaterial({
						transparent: true,
						opacity: 1,
						side: THREE.DoubleSide,
						toneMapped: false
					});

					// If we already have a canvas, apply it
					if (canvas) {
						handleCanvasReady(canvas);
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
			console.log('Added model to scene');
			
			modelLoaded = true;

			// Setup animations if they exist
			if (gltf.animations && gltf.animations.length) {
				mixer = new THREE.AnimationMixer(model);
				const action = mixer.clipAction(gltf.animations[0]);
				action.play();
			}

			// Start animation loop (but don't show yet)
			const clock = new THREE.Clock();
			const animate = () => {
				if (!modelLoaded) return;

				animationFrameId = requestAnimationFrame(animate);

				// Only update and render if visible
				if (isVisible) {
					// Update canvas texture if it exists
					updateCanvasTexture();

					// Update any animations or controls
					if (mixer) {
						mixer.update(0.016);
					}

					if (CONFIG.subtleRotation.enabled && !isTransitioning && model) {
						model.rotation.y += CONFIG.subtleRotation.speed;
					}

					renderer.render(scene, camera);
				}
			};
			animate();
		} catch (error) {
			console.error('Error loading model:', error);
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
		if (renderTarget) {
			renderTarget.dispose();
		}
		if (canvasTexture) {
			canvasTexture.dispose();
		}
	});
</script>

<div class="three-container" class:visible={isVisible} bind:this={container}>
	<canvas bind:this={renderCanvas}></canvas>
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
