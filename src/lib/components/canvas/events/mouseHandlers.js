import { getContainerDimensions } from '../utils/dimensions.js';
import { CONFIG } from '../config.js';

/**
 * Mouse event handling for canvas interactions
 */

/**
 * Get pointer position relative to canvas
 * @param {MouseEvent|TouchEvent} e - Mouse or touch event
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @returns {Object} - {x, y} coordinates
 */
export function getPointerPos(e, canvas) {
    if (!canvas) return { x: 0, y: 0 };
    
    // Handle both mouse and touch events
    const pointer = e.touches ? e.touches[0] : e;
    const rect = canvas.getBoundingClientRect();
    
    return {
        x: pointer.clientX - rect.left,
        y: pointer.clientY - rect.top
    };
}

/**
 * Create a mouse handler factory that manages canvas interactions
 * @param {Object} options - Configuration options 
 * @returns {Object} - Mouse handler methods
 */
export function createMouseHandlers(options) {
    const {
        canvas,
        onParticlesCreated,
        onMagnetInteraction,
        onCursorUpdate
    } = options;
    
    // State variables
    let lastMouseX = 0;
    let lastMouseY = 0;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let isClicking = false;
    let isTransitioning = false;
    let lastInteractionTime = performance.now();
    
    /**
     * Generate particles between two points
     */
    function generateParticles(x1, y1, x2, y2) {
        const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const { width, height } = getContainerDimensions(canvas);

        // Scale up density for short distances
        let scaledDensity = CONFIG.particleDensity;
        if (distance < 20) {
            scaledDensity = CONFIG.particleDensity * (1 + (20 - distance) / 20);
        }

        // Create points along the path
        const points = [];
        const particleCount = Math.max(1, Math.floor(distance * scaledDensity));

        // Add points along the path
        for (let i = 0; i <= particleCount; i++) {
            const t = i / particleCount;
            points.push({
                x: x1 + (x2 - x1) * t,
                y: y1 + (y2 - y1) * t
            });
        }

        // Call the callback with the generated points
        if (onParticlesCreated) {
            onParticlesCreated(points);
        }
    }
    
    /**
     * Handle mouse/pointer movement
     */
    function handlePointerMove(e) {
        if (isTransitioning) return;

        // Update interaction time
        lastInteractionTime = performance.now();
        
        const pos = getPointerPos(e, canvas);
        const currentX = pos.x;
        const currentY = pos.y;

        // Update cursor position for rendering
        if (onCursorUpdate) {
            onCursorUpdate({
                x: currentX,
                y: currentY,
                isClicking
            });
        }

        // Generate particles on movement while clicking
        if (isClicking) {
            generateParticles(
                lastPointerX, 
                lastPointerY, 
                currentX, 
                currentY
            );
        }

        // Store position for next frame
        lastPointerX = currentX;
        lastPointerY = currentY;
    }
    
    /**
     * Handle mouse/pointer down event
     */
    function handlePointerDown(e) {
        if (isTransitioning) return;
        
        // Update interaction time
        lastInteractionTime = performance.now();
        isClicking = true;
        
        const pos = getPointerPos(e, canvas);
        lastPointerX = pos.x;
        lastPointerY = pos.y;
        
        // Check for magnet interactions
        if (onMagnetInteraction) {
            onMagnetInteraction({
                x: lastPointerX,
                y: lastPointerY,
                type: 'down'
            });
        }
        
        // Update cursor state
        if (onCursorUpdate) {
            onCursorUpdate({
                x: lastPointerX,
                y: lastPointerY,
                isClicking: true
            });
        }
    }
    
    /**
     * Handle mouse/pointer up event
     */
    function handlePointerUp(e) {
        isClicking = false;

        if (isTransitioning) return;
        
        const pos = getPointerPos(e, canvas);
        
        // Check for magnet interactions
        if (onMagnetInteraction) {
            onMagnetInteraction({
                x: pos.x,
                y: pos.y,
                type: 'up'
            });
        }
        
        // Update cursor state
        if (onCursorUpdate) {
            onCursorUpdate({
                x: pos.x,
                y: pos.y,
                isClicking: false
            });
        }
    }
    
    /**
     * Set transitioning state to prevent interaction
     */
    function setTransitioning(value) {
        isTransitioning = value;
    }
    
    /**
     * Get the last interaction time
     */
    function getLastInteractionTime() {
        return lastInteractionTime;
    }
    
    return {
        handlePointerMove,
        handlePointerDown,
        handlePointerUp,
        setTransitioning,
        getLastInteractionTime
    };
}
