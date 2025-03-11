import { CONFIG } from '../config.js';
import { hexToRGBA } from '../utils/colors.js';

/**
 * Particle batch renderer for efficient canvas rendering
 */
export class ParticleBatch {
    constructor() {
        this.particles = new Map(); // Map of opacity -> particles array
        this.offscreenCanvas = null;
        this.offscreenCtx = null;
    }

    _initOffscreenCanvas(width, height) {
        if (!this.offscreenCanvas) {
            this.offscreenCanvas = document.createElement('canvas');
        }
        // Only resize if needed
        if (
            this.offscreenCanvas.width !== width ||
            this.offscreenCanvas.height !== height
        ) {
            this.offscreenCanvas.width = width;
            this.offscreenCanvas.height = height;
            this.offscreenCtx = this.offscreenCanvas.getContext('2d');
            // Match main canvas settings
            this.offscreenCtx.imageSmoothingEnabled = true;
            this.offscreenCtx.imageSmoothingQuality = 'high';
        }
    }

    add(particle) {
        const key = particle.opacity || 1;
        if (!this.particles.has(key)) {
            this.particles.set(key, []);
        }
        this.particles.get(key).push(particle);
    }

    clear() {
        this.particles.clear();
    }

    clearToX(x) {
        // Remove particles to the right of x
        for (const [opacity, particles] of this.particles.entries()) {
            this.particles.set(
                opacity,
                particles.filter((p) => p.x <= x)
            );
        }
    }

    render(ctx) {
        if (!ctx) return;

        // Initialize or resize offscreen canvas if needed
        this._initOffscreenCanvas(ctx.canvas.width, ctx.canvas.height);

        // Clear the offscreen canvas with transparent background
        this.offscreenCtx.clearRect(
            0,
            0,
            this.offscreenCanvas.width,
            this.offscreenCanvas.height
        );

        // Group particles by their properties for efficient rendering
        const renderGroups = new Map();

        // Process all particles and group them
        for (const [opacity, particleList] of this.particles.entries()) {
            for (const particle of particleList) {
                // Skip if particle is outside viewport
                if (!isInViewport(particle, ctx.canvas)) continue;

                // Create group key based on visual properties
                const color = particle.color;
                const finalOpacity =
                    particle.opacity !== undefined ? particle.opacity : opacity;
                const key = `${color}-${finalOpacity}-${particle.isPredrawn}-${particle.isStampParticle}`;

                if (!renderGroups.has(key)) {
                    renderGroups.set(key, {
                        color,
                        opacity: finalOpacity,
                        particles: [],
                    });
                }
                renderGroups.get(key).particles.push(particle);
            }
        }

        // Render each group to offscreen canvas
        for (const group of renderGroups.values()) {
            const { color, opacity, particles } = group;
            if (particles.length === 0) continue;

            this.offscreenCtx.save();

            // Set style once for the batch
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            this.offscreenCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;

            // Draw all particles in the batch
            for (const particle of particles) {
                this.offscreenCtx.save();
                this.offscreenCtx.translate(particle.x, particle.y);
                this.offscreenCtx.rotate(particle.angle);
                this.offscreenCtx.fillRect(
                    -particle.length / 2,
                    -particle.width / 2,
                    particle.length,
                    particle.width
                );
                this.offscreenCtx.restore();
            }

            this.offscreenCtx.restore();
        }

        // Draw the final result to the main canvas
        ctx.drawImage(this.offscreenCanvas, 0, 0);
    }
}

/**
 * Check if a particle is within the viewport
 * @param {Object} particle - Particle object with x,y coordinates and dimensions
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @returns {boolean} - Whether the particle is in the viewport
 */
export function isInViewport(particle, canvas) {
    if (!canvas) return false;
    
    // Add padding to account for particle size and rotation
    const padding = Math.max(particle.length, particle.width) * 2;
    return (
        particle.x + padding >= 0 &&
        particle.x - padding <= canvas.width &&
        particle.y + padding >= 0 &&
        particle.y - padding <= canvas.height
    );
}

/**
 * Create a particle at the specified position
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {boolean} isPredrawn - Whether this is a pre-drawn particle
 * @param {boolean} isStampParticle - Whether this is a stamp particle
 * @returns {Object} - The created particle object
 */
export function createParticle(x, y, isPredrawn = false, isStampParticle = false) {
    const size = isPredrawn 
        ? CONFIG.preDrawnParticleSize 
        : CONFIG.particleSize;
        
    // Base color
    let color = isPredrawn 
        ? CONFIG.preDrawnColor 
        : CONFIG.particleColor;
    
    // Chance to make white particles
    const whiteProb = isStampParticle 
        ? CONFIG.stampWhiteParticleProbability 
        : (isPredrawn ? CONFIG.multitextWhiteProb : 0);
        
    if (Math.random() < whiteProb) {
        color = '#FFFFFF';
    }
    
    return {
        x,
        y,
        length: isPredrawn ? size : CONFIG.particleLength * CONFIG.lineWidth,
        width: isPredrawn ? size : CONFIG.particleWidth * CONFIG.lineWidth,
        angle: Math.random() * Math.PI * 2,
        color,
        opacity: isPredrawn ? CONFIG.multitextOpacity : CONFIG.particleOpacity,
        isPredrawn,
        isStampParticle
    };
}

/**
 * Create particles along a path defined by points
 * @param {Array} points - Array of {x,y} points defining the path
 * @param {Object} options - Options for particle creation
 * @returns {Array} - Array of created particles
 */
export function createParticlesAlongPath(points, options = {}) {
    const defaultOptions = {
        particleSize: CONFIG.particleSize,
        density: CONFIG.particleDensity,
        randomOffset: CONFIG.lineWidth * 0.3,
        color: CONFIG.particleColor,
        opacity: CONFIG.particleOpacity,
        isPredrawn: false,
        isStampParticle: false
    };

    // Merge options with defaults
    const opts = { ...defaultOptions, ...options };
    const particles = [];
    
    // Handle single point case
    if (points.length === 1) {
        const p = points[0];
        particles.push(createParticle(
            p.x, 
            p.y, 
            opts.isPredrawn, 
            opts.isStampParticle
        ));
        return particles;
    }
    
    // Generate particles along path segments
    for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        
        // Calculate segment length and number of particles
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Scale up particle count for short distances
        let scaledDensity = opts.density;
        if (distance < 20) {
            scaledDensity = opts.density * (1 + (20 - distance) / 20);
        }
        
        // Calculate particles for this segment
        const particleCount = Math.max(1, Math.floor(distance * scaledDensity));
        
        for (let j = 0; j < particleCount; j++) {
            // Position along the line
            const t = j / particleCount;
            
            // Add some randomness to position
            const randomX = (Math.random() - 0.5) * opts.randomOffset;
            const randomY = (Math.random() - 0.5) * opts.randomOffset;
            
            const x = p1.x + dx * t + randomX;
            const y = p1.y + dy * t + randomY;
            
            const particle = createParticle(
                x, 
                y, 
                opts.isPredrawn, 
                opts.isStampParticle
            );
            
            // Apply custom color and opacity if provided
            if (opts.color) {
                particle.color = opts.color;
            }
            if (opts.opacity !== undefined) {
                particle.opacity = opts.opacity;
            }
            
            particles.push(particle);
        }
    }
    
    return particles;
}

/**
 * Prepare particle data for WebGL rendering
 * @param {Array} particles - Array of particle objects
 * @returns {Object} - Object with positions and colors arrays for WebGL
 */
export function prepareParticleData(particles) {
    const positions = new Float32Array(particles.length * 2);
    const colors = new Float32Array(particles.length * 4);

    particles.forEach((particle, i) => {
        const posIndex = i * 2;
        const colorIndex = i * 4;

        // Set position
        positions[posIndex] = particle.x;
        positions[posIndex + 1] = particle.y;

        // Set color
        const rgba = hexToRGBA(
            particle.color,
            particle.opacity !== undefined ? particle.opacity : 1
        );
        colors[colorIndex] = rgba[0];
        colors[colorIndex + 1] = rgba[1];
        colors[colorIndex + 2] = rgba[2];
        colors[colorIndex + 3] = rgba[3];
    });

    return { positions, colors };
}
