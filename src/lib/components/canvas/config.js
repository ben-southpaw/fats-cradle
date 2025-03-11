// Canvas configuration constants

// Base config values - these are the values for the reference viewport size
export const BASE_CONFIG = {
    // Non-relative properties first so we can reference them
    lineWidth: 12,

    // Sizes relative to lineWidth
    particleSize: 0.75, // 75% of lineWidth
    particleLength: 0.5, // 50% of lineWidth
    particleWidth: 0.6, // 60% of lineWidth

    // Density as particles per lineWidth
    particleDensity: 0.7, // 1 particle per 2 lineWidths

    // Non-relative properties
    backgroundColor: '#f2f2f2',
    gridColor: '#C8C8C8',
    hexagonSize: 3,
    particleColor: '#666666',
    particleOpacity: 1,
    preDrawnParticleSize: 1,
    preDrawnDensity: 0.9,
    preDrawnColor: '#333333',
    multitextDensity: 9.0,
    multitextOpacity: 1,
    multitextWhiteProb: 0,
    cursorWhiteParticleProbability: 0.1,
    stampWhiteParticleProbability: 0.2,
    targetFPS: 60,
    idleFPS: 30,
    idleTimeout: 1000,
    hexagonLineWidth: 0.3,
    initialStampOpacity: 0.9,
    subsequentStampOpacity: 0.65,
    initialStampDensity: {
        edge: 1.4,
        fill: 1.9,
    },
    subsequentStampDensity: {
        edge: 1.2,
        fill: 1.3,
    },
    maxParticles: 40000,
};

// Default configuration that can be used directly
export const CONFIG = {
    ...BASE_CONFIG,
    initialStampDensity: {
        edge: BASE_CONFIG.initialStampDensity.edge,
        fill: BASE_CONFIG.initialStampDensity.fill,
    },
    subsequentStampDensity: {
        edge: BASE_CONFIG.subsequentStampDensity.edge,
        fill: BASE_CONFIG.subsequentStampDensity.fill,
    },
};

// Function to create a custom configuration with overrides
export function createConfig(overrides = {}) {
    return {
        ...CONFIG,
        ...overrides,
        initialStampDensity: {
            edge: overrides.initialStampDensity?.edge ?? CONFIG.initialStampDensity.edge,
            fill: overrides.initialStampDensity?.fill ?? CONFIG.initialStampDensity.fill,
        },
        subsequentStampDensity: {
            edge: overrides.subsequentStampDensity?.edge ?? CONFIG.subsequentStampDensity.edge,
            fill: overrides.subsequentStampDensity?.fill ?? CONFIG.subsequentStampDensity.fill,
        },
    };
}
