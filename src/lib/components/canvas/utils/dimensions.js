/**
 * Utility functions for managing canvas dimensions
 */

/**
 * Get the dimensions of the canvas container
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @returns {Object} The width and height of the container
 */
export function getContainerDimensions(canvas) {
    if (!canvas) 
        return { width: window.innerWidth, height: window.innerHeight };
    
    const container = canvas.parentElement;
    if (!container)
        return { width: window.innerWidth, height: window.innerHeight };

    return {
        width: container.clientWidth,
        height: container.clientHeight,
    };
}

/**
 * Check if a point is within the canvas bounds
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @returns {boolean} Whether the point is within the canvas bounds
 */
export function isWithinCanvasBounds(x, y, canvas) {
    if (!canvas) return false;
    
    return (
        x >= 0 && 
        x <= canvas.width && 
        y >= 0 && 
        y <= canvas.height
    );
}
