<script>
import { onMount, onDestroy } from 'svelte';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { gsap } from 'gsap';

let container;
let scene;
let camera;
let renderer;
let model;
let animationFrameId;
let mixer;

// Animation state
let isTransitioning = false;
let currentScale = 0;
let targetScale = 1;

// Model state
let modelLoaded = false;
let initialModelScale = new THREE.Vector3(1, 1, 1);
let finalModelScale = new THREE.Vector3(1.5, 1.5, 1.5);

export function startTransition() {
    if (!modelLoaded) return;
    isTransitioning = true;
    
    // Animation sequence
    const timeline = gsap.timeline();
    
    // 1. Scale up with rotation
    timeline.to(model.scale, {
        x: 2.5,
        y: 2.5,
        z: 2.5,
        duration: 1,
        ease: "power2.out"
    });
    
    // 2. Rotate while scaling
    timeline.to(model.rotation, {
        y: Math.PI * 2,
        duration: 2,
        ease: "power1.inOut"
    }, "-=0.5"); // Start slightly before scale finishes
    
    // 3. Scale down to final position
    timeline.to(model.scale, {
        x: finalModelScale.x,
        y: finalModelScale.y,
        z: finalModelScale.z,
        duration: 1,
        ease: "elastic.out(1, 0.5)"
    });
}

onMount(async () => {
    // Scene setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ 
        alpha: true,
        antialias: true 
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    
    // Set initial camera position
    camera.position.z = 5;
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // Load model
    const loader = new GLTFLoader();
    try {
        const gltf = await loader.loadAsync('/src/lib/3d/MagnaSketch_3dModel.gltf');
        model = gltf.scene;
        
        // Set initial model properties
        model.scale.copy(initialModelScale);
        model.position.set(0, 0, 0);
        scene.add(model);
        
        // Setup animations if they exist
        if (gltf.animations && gltf.animations.length) {
            mixer = new THREE.AnimationMixer(model);
            const action = mixer.clipAction(gltf.animations[0]);
            action.play();
        }
        
        modelLoaded = true;
    } catch (error) {
        console.error('Error loading model:', error);
    }
    
    // Handle window resize
    const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    
    // Animation loop
    const clock = new THREE.Clock();
    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        
        if (mixer) {
            mixer.update(clock.getDelta());
        }
        
        if (model) {
            model.rotation.y += 0.001; // Subtle continuous rotation
        }
        
        renderer.render(scene, camera);
    };
    animate();
    
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
    if (renderer) {
        renderer.dispose();
    }
});
</script>

<div 
    bind:this={container} 
    class="three-container"
    class:transitioning={isTransitioning}
>
</div>

<style>
.three-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    opacity: 1;
    transition: opacity 0.5s ease-in-out;
}

.three-container.transitioning {
    pointer-events: auto;
}
</style>
