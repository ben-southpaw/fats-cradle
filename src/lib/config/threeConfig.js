import { get } from 'svelte/store';
import { breakpoint, BREAKPOINTS } from '$lib/stores/breakpoint';

export function getModelScale() {
  const currentBreakpoint = get(breakpoint);
  
  if (currentBreakpoint === BREAKPOINTS.MOBILE) return 0.4;
  if (currentBreakpoint === BREAKPOINTS.TABLET) return 0.8;
  return 1.5; // Desktop default
}

export const MODEL_CONFIG = {
  path: '/models/MagnaSketch_3dModel.glb',
  initial: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { 
      get x() { return getModelScale() },
      get y() { return getModelScale() },
      get z() { return getModelScale() }
    },
  },
  final: {
    position: { x: 0, y: 0, z: -2 },
    rotation: { x: 0, y: Math.PI * 2, z: 0 },
    scale: { 
      get x() { return getModelScale() },
      get y() { return getModelScale() },
      get z() { return getModelScale() }
    },
  },
};

export const CAMERA_CONFIG = {
  fov: 35,
  near: 0.1,
  far: 800,
  position: { x: 0, y: 0, z: 10 },
};

export const LIGHTING_CONFIG = {
  ambient: {
    color: 0xffffff,
    intensity: 0.3,
  },
  // Add other lighting configs as needed
};
