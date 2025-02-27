import { writable, derived } from 'svelte/store';

// Create a store for environment variables
export const environmentContext = writable({
  isInIframe: false,
  devicePixelRatio: 1,
  canvasWidth: 0,
  canvasHeight: 0,
  containerWidth: 0,
  containerHeight: 0,
  scaleFactor: 1,
  isInitialized: false
});

// Default configuration that doesn't depend on canvas size
export const BASE_CONFIG = {
  particleSize: 10,
  particleDensity: 10,
  lineWidth: 12,
  backgroundColor: '#f2f2f2',
  gridColor: '#C8C8C8',
  hexagonSize: 4.5,
  particleLength: 12,
  particleWidth: 12,
  particleColor: '#666666',
  particleOpacity: 1,
  preDrawnParticleSize: 1,
  preDrawnDensity: 0.9,
  preDrawnColor: '#333333',
  multitextDensity: 9.0,
  multitextOpacity: 1,
  multitextWhiteProb: 0,
  cursorWhiteParticleProbability: 0,
  stampWhiteParticleProbability: 0.2,
  targetFPS: 60,
  idleFPS: 30,
  idleTimeout: 1000,
  hexagonLineWidth: 0.3,
  initialStampOpacity: 0.99,
  subsequentStampOpacity: 0.75,
  initialStampDensity: {
    edge: 1.4,
    fill: 1.6,
  },
  subsequentStampDensity: {
    edge: 1.2,
    fill: 0.9,
  },
  maxParticles: 40000,
};

// Create a derived store for the scaled configuration
export const scaledConfig = derived(environmentContext, ($env) => {
  // Default to base config if not initialized
  if (!$env.isInitialized) {
    return { ...BASE_CONFIG };
  }

  // Calculate scale factor based on device pixel ratio and iframe status
  const scalingFactor = $env.isInIframe ? 0.5 : 1;
  
  // Create a scaled configuration with adjusted values
  return {
    ...BASE_CONFIG,
    particleDensity: BASE_CONFIG.particleDensity * scalingFactor,
    preDrawnDensity: BASE_CONFIG.preDrawnDensity * scalingFactor,
    multitextDensity: BASE_CONFIG.multitextDensity * scalingFactor,
    initialStampDensity: {
      edge: BASE_CONFIG.initialStampDensity.edge * scalingFactor,
      fill: BASE_CONFIG.initialStampDensity.fill * scalingFactor,
    },
    subsequentStampDensity: {
      edge: BASE_CONFIG.subsequentStampDensity.edge * scalingFactor,
      fill: BASE_CONFIG.subsequentStampDensity.fill * scalingFactor,
    },
    maxParticles: Math.floor(BASE_CONFIG.maxParticles * scalingFactor),
    // Scale lineWidth based on canvas dimensions for consistent appearance
    lineWidth: BASE_CONFIG.lineWidth * $env.scaleFactor,
  };
});

// Initialize the environment context
export function initializeEnvironment(canvas) {
  if (!canvas) return;
  
  const container = canvas.parentElement;
  const isInIframe = window !== window.top;
  const dpr = window.devicePixelRatio || 1;
  
  const containerWidth = container?.clientWidth || window.innerWidth;
  const containerHeight = container?.clientHeight || window.innerHeight;
  
  // Calculate scale factor based on container size
  // This ensures consistent appearance across different sized canvases
  const refSize = 1920; // Reference width for scaling
  const scaleFactor = Math.min(containerWidth / refSize, 1);
  
  environmentContext.update(() => ({
    isInIframe,
    devicePixelRatio: dpr,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    containerWidth,
    containerHeight,
    scaleFactor,
    isInitialized: true
  }));
}

// Update environment when canvas size changes
export function updateEnvironment(canvas) {
  if (!canvas) return;
  
  const container = canvas.parentElement;
  
  environmentContext.update(env => ({
    ...env,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    containerWidth: container?.clientWidth || window.innerWidth,
    containerHeight: container?.clientHeight || window.innerHeight,
    scaleFactor: Math.min((container?.clientWidth || window.innerWidth) / 1920, 1)
  }));
}
