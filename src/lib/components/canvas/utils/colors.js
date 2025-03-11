/**
 * Utility functions for color manipulation
 */

/**
 * Convert hex color to rgba values
 * @param {string} hex - Hex color code starting with #
 * @param {number} alpha - Alpha value (0-1)
 * @returns {Array} Array of [r, g, b, alpha] values in 0-1 range
 */
export function hexToRGBA(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b, alpha];
}

/**
 * Convert hex color to rgba CSS string
 * @param {string} hex - Hex color code starting with #
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA CSS color string
 */
export function hexToRGBAString(hex, alpha = 1) {
    const [r, g, b] = hexToRGBA(hex, 1);
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
}

/**
 * Parse a color string (hex or rgba) and return rgba values
 * @param {string} color - Color string (hex or rgba)
 * @returns {Array} Array of [r, g, b, alpha] values in 0-1 range
 */
export function parseColor(color) {
    if (color.startsWith('#')) {
        return hexToRGBA(color);
    } else if (color.startsWith('rgba')) {
        const values = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)/);
        if (values) {
            return [
                parseInt(values[1]) / 255,
                parseInt(values[2]) / 255,
                parseInt(values[3]) / 255,
                values[4] ? parseFloat(values[4]) : 1
            ];
        }
    }
    return [0, 0, 0, 1]; // Default to black if parsing fails
}
