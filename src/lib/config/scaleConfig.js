import { get } from 'svelte/store';
// import { breakpoint, BREAKPOINTS } from '../stores/breakpoint';
import { isMobile } from '$lib/stores/breakpoint';

/**
 * Scale configuration for the 3D model
 */
export const MODEL_SCALE = {
	// Default scale factors by device type
	MOBILE: 0.4,
	
	DESKTOP: 1.5,

	// Get the appropriate scale factor based on current breakpoint
	get() {
		return get(isMobile) ? this.MOBILE : this.DESKTOP;
	},
};

/**
 * Scale configuration for magnets
 */
export const MAGNET_SCALE = {
	// Base scale multiplier (applied to all devices)
	BASE: 1.5,

	// Breakpoint-specific scaling factors
	MOBILE: 1.2,
	
	DESKTOP: 1.0,

	// Get the appropriate scale factor based on current breakpoint
	get() {
		return get(isMobile) ? this.MOBILE : this.DESKTOP;
	},
};

/**
 * Configuration for multi-text positioning and scaling
 */
export const MULTI_TEXT_CONFIG = {
	// X offset as percentage of container width
	X_OFFSET: {
		NARROW: 0.33, // For width < 1450px
		WIDE: 0.4, // For width >= 1450px
	},

	// Y offset as percentage of container height
	Y_OFFSET: {
		MOBILE: 0.45,
		
		DESKTOP: 0.3,
	},

	// Get the Y offset percentage based on current breakpoint
	getYOffset() {
		return get(isMobile) ? this.Y_OFFSET.MOBILE : this.Y_OFFSET.DESKTOP;
	},
};

/**
 * Helper function to calculate scale based on container dimensions
 * @param {number} containerWidth - Width of the container
 * @param {number} containerHeight - Height of the container (optional)
 * @returns {number} - The calculated base scale
 */
export function calculateBaseScale(containerWidth, containerHeight = null) {
	// Base scale calculation (currently based only on width)
	return containerWidth / 1920;
}

/**
 * Helper function to get the final scaled dimensions
 * @param {Object} dimensions - Original width and height
 * @param {number} baseScale - Base scale factor
 * @param {number} deviceScale - Device-specific scale factor
 * @returns {Object} - Scaled width and height
 */
export function getScaledDimensions(dimensions, baseScale, deviceScale = 1) {
	return {
		width: dimensions.width * baseScale * deviceScale,
		height: dimensions.height * baseScale * deviceScale,
	};
}
