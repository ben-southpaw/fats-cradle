/**
 * Central Configuration Export
 * 
 * This file serves as the main entry point for all configuration objects.
 * It re-exports all configuration from individual files for convenient importing.
 */

// Export scale configurations
export * from './scaleConfig';

// Export model and three.js related configurations
export * from './modelConfig';

// Export animation configurations
export * from './animationConfig';

// Export WebGL shader configurations
export * from './shaderConfig';

// Export application state configurations
export * from './appStateConfig';

/**
 * Usage examples:
 * 
 * 1. Import specific config objects:
 *    import { MODEL_SCALE, ANIMATION_CONFIG } from '$lib/config';
 * 
 * 2. Import all configs (not recommended for production due to bundle size):
 *    import * as CONFIG from '$lib/config';
 */
