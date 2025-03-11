import { CONFIG } from '../config.js';

/**
 * MagnetManager handles magnet creation, positioning, and interaction
 */
export class MagnetManager {
    constructor(options = {}) {
        this.magnets = [];
        this.nextMagnetId = 1;
        this.canvas = options.canvas;
        this.textures = new Map();
        this.magnetImages = {};
        this.onMagnetChange = options.onMagnetChange;
        this.onMagnetStamp = options.onMagnetStamp;
    }

    /**
     * Initialize a new magnet
     * @param {Object} options - Magnet options
     * @returns {Object} - The created magnet
     */
    createMagnet(options = {}) {
        const { x, y, type, img, width, height } = options;
        
        const magnet = {
            id: this.nextMagnetId++,
            x: x || 0,
            y: y || 0,
            type: type || 'F',
            img: img,
            width: width || 0,
            height: height || 0,
            rotation: 0,
            scale: 1,
            isDragging: false,
            isStamping: false,
            isStamped: false
        };
        
        this.magnets.push(magnet);
        
        // Notify about magnet change
        if (this.onMagnetChange) {
            this.onMagnetChange(magnet);
        }
        
        return magnet;
    }
    
    /**
     * Add an image for a magnet type
     * @param {string} type - Magnet type
     * @param {HTMLImageElement} img - Image element
     */
    addMagnetImage(type, img) {
        this.magnetImages[type] = img;
    }
    
    /**
     * Add a WebGL texture for a magnet type
     * @param {string} type - Magnet type
     * @param {WebGLTexture} texture - WebGL texture
     */
    addMagnetTexture(type, texture) {
        this.textures.set(type, texture);
    }
    
    /**
     * Get all magnets
     * @returns {Array} - Array of magnets
     */
    getMagnets() {
        return this.magnets;
    }
    
    /**
     * Get a specific magnet by ID
     * @param {number} id - Magnet ID
     * @returns {Object|null} - Magnet object or null if not found
     */
    getMagnetById(id) {
        return this.magnets.find(m => m.id === id) || null;
    }
    
    /**
     * Check if a point is inside a magnet
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Object} magnet - Magnet object
     * @returns {boolean} - Whether the point is inside the magnet
     */
    isPointInMagnet(x, y, magnet) {
        if (!magnet || !magnet.width || !magnet.height) return false;
        
        const centerX = magnet.x;
        const centerY = magnet.y;
        const width = magnet.width * (magnet.scale || 1);
        const height = magnet.height * (magnet.scale || 1);
        
        // Simple rectangular hit testing
        return (
            x >= centerX - width / 2 &&
            x <= centerX + width / 2 &&
            y >= centerY - height / 2 &&
            y <= centerY + height / 2
        );
    }
    
    /**
     * Find the magnet at a specific point
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Object|null} - Magnet object or null if none found
     */
    findMagnetAt(x, y) {
        // Check in reverse order (top to bottom in z-order)
        for (let i = this.magnets.length - 1; i >= 0; i--) {
            const magnet = this.magnets[i];
            if (this.isPointInMagnet(x, y, magnet)) {
                return magnet;
            }
        }
        return null;
    }
    
    /**
     * Start dragging a magnet
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Object|null} - The magnet being dragged or null
     */
    startDragging(x, y) {
        const magnet = this.findMagnetAt(x, y);
        if (magnet) {
            magnet.isDragging = true;
            magnet.dragOffsetX = x - magnet.x;
            magnet.dragOffsetY = y - magnet.y;
            
            // Move the dragged magnet to the end of the array (top of z-order)
            this.magnets = this.magnets.filter(m => m.id !== magnet.id);
            this.magnets.push(magnet);
            
            // Notify about magnet change
            if (this.onMagnetChange) {
                this.onMagnetChange(magnet);
            }
        }
        return magnet;
    }
    
    /**
     * Move a dragging magnet
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    moveDragging(x, y) {
        const draggedMagnet = this.magnets.find(m => m.isDragging);
        if (draggedMagnet) {
            // Update position based on drag offset
            draggedMagnet.x = x - (draggedMagnet.dragOffsetX || 0);
            draggedMagnet.y = y - (draggedMagnet.dragOffsetY || 0);
            
            // Check canvas bounds
            if (this.canvas) {
                const width = draggedMagnet.width * (draggedMagnet.scale || 1);
                const height = draggedMagnet.height * (draggedMagnet.scale || 1);
                
                // Keep magnet within canvas bounds
                draggedMagnet.x = Math.max(width / 2, Math.min(this.canvas.width - width / 2, draggedMagnet.x));
                draggedMagnet.y = Math.max(height / 2, Math.min(this.canvas.height - height / 2, draggedMagnet.y));
            }
            
            // Notify about magnet change
            if (this.onMagnetChange) {
                this.onMagnetChange(draggedMagnet);
            }
        }
    }
    
    /**
     * Stop dragging all magnets
     * @param {number} x - X coordinate where dragging stopped
     * @param {number} y - Y coordinate where dragging stopped
     * @returns {Object|null} - The magnet that was being dragged or null
     */
    stopDragging(x, y) {
        const draggedMagnet = this.magnets.find(m => m.isDragging);
        if (draggedMagnet) {
            draggedMagnet.isDragging = false;
            delete draggedMagnet.dragOffsetX;
            delete draggedMagnet.dragOffsetY;
            
            // Notify about magnet change
            if (this.onMagnetChange) {
                this.onMagnetChange(draggedMagnet);
            }
            
            return draggedMagnet;
        }
        return null;
    }
    
    /**
     * Create a stamp from a magnet
     * @param {Object} magnet - The magnet to stamp
     */
    createMagnetStamp(magnet) {
        if (!magnet || !magnet.img || !magnet.img.complete) return;
        
        // Skip if magnet is currently being stamped
        if (magnet.isStamping) return;
        
        // Mark as stamping
        magnet.isStamping = true;
        
        // Callback for stamp creation
        if (this.onMagnetStamp) {
            this.onMagnetStamp(magnet);
        }
        
        // Mark as stamped
        magnet.isStamped = true;
        
        // Reset stamping state after a short delay
        setTimeout(() => {
            magnet.isStamping = false;
        }, 100);
    }
}
