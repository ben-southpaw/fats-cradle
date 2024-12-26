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
let initialModelScale = new THREE.Vector3(3, 3, 3); // Start larger
let finalModelScale = new THREE.Vector3(1, 1, 1); // End at normal scale

// Model state
let modelLoaded = false;

export function startTransition() {
    if (!modelLoaded) return;
    isTransitioning = true;
    
    // Animation sequence
    const timeline = gsap.timeline();
    
    // Fade in while rotating and scaling down
    timeline
        .to(container, {
            opacity: 1,
            duration: 1.5,
            ease: "power2.inOut"
        })
        .to(model.rotation, {
            y: model.rotation.y + Math.PI * 2, // Full rotation
            duration: 2,
            ease: "power1.inOut"
        }, 0) // Start at the same time as opacity
        .to(model.scale, {
            x: finalModelScale.x,
            y: finalModelScale.y,
            z: finalModelScale.z,
            duration: 2,
            ease: "power2.inOut"
        }, 0); // Start at the same time as opacity
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
        
        // Start subtle rotation animation
        const subtleRotate = () => {
            if (model && !isTransitioning) {
                model.rotation.y += 0.005;
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
    opacity: 0;
}

.three-container.transitioning {
    pointer-events: auto;
}
</style>
