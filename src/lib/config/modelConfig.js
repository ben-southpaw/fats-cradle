/**
 * Model Configuration
 * Centralized configuration for 3D model properties, positioning and behavior
 */
import { get } from 'svelte/store';
import { deviceInfo } from '../stores/appState';
import { MODEL_SCALE } from './scaleConfig';

/**
 * Main 3D model configuration
 */
export const MODEL_CONFIG = {
  // Model path
  PATH: '/models/MagnaSketch_3dModel.glb',
  
  // Initial model position, rotation and scale
  INITIAL: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    // Scale is derived from MODEL_SCALE in scaleConfig.js
    get scale() { 
      try {
        const scale = MODEL_SCALE.get();
        return { x: scale, y: scale, z: scale };
      } catch (error) {
        console.warn('Error getting model scale', error);
        // Fallback values
        const isMobile = get(deviceInfo)?.isMobile;
        const isTablet = get(deviceInfo)?.isTablet;
        let scale = 1.5; // desktop default
        
        if (isMobile) scale = 0.4;
        if (isTablet) scale = 0.8;
        
        return { x: scale, y: scale, z: scale };
      }
    }
  },
  
  // Final model position after transition
  FINAL: {
    position: { x: 0, y: 0, z: -2 },
    rotation: { x: 0, y: Math.PI * 2, z: 0 },
    // Scale is derived from MODEL_SCALE in scaleConfig.js
    get scale() {
      try {
        const scale = MODEL_SCALE.get();
        return { x: scale, y: scale, z: scale };
      } catch (error) {
        console.warn('Error getting model scale', error);
        // Fallback values
        const isMobile = get(deviceInfo)?.isMobile;
        const isTablet = get(deviceInfo)?.isTablet;
        let scale = 1.5; // desktop default
        
        if (isMobile) scale = 0.4;
        if (isTablet) scale = 0.8;
        
        return { x: scale, y: scale, z: scale };
      }
    }
  },
  
  // Model parts configuration
  PARTS: {
    SCREEN: {
      name: 'Screen',
      opacity: 1.0,
      visible: true
    },
    MAGNETS: {
      name: 'MagnetsGrp',
      visible: true
    },
    SLIDER: {
      name: 'SliderKnob',
      bounds: {
        min: -0.8,
        max: 0.8
      }
    }
  },
  
  // Material configurations for different model parts
  MATERIALS: {
    SCREEN: {
      color: 0xffffff,
      emissive: 0x333333,
      roughness: 0.2,
      metalness: 0.8
    }
  },
  
  // Helper method to get device-appropriate model rotation
  getRotationSpeed: () => {
    try {
      const isMobile = get(deviceInfo)?.isMobile;
      const isTablet = get(deviceInfo)?.isTablet;
      
      if (isMobile) return 0.003;
      if (isTablet) return 0.002;
      return 0.001; // desktop
    } catch (error) {
      console.warn('Error getting model rotation speed', error);
      return 0.001; // default
    }
  }
};

/**
 * Camera configuration
 */
export const CAMERA_CONFIG = {
  FOV: 45,
  NEAR: 0.1,
  FAR: 1000,
  POSITION: {
    INITIAL: { x: 0, y: 0, z: 5 },
    TRANSITION: { x: 0, y: 0, z: 4 }
  }
};

/**
 * Lighting configuration
 */
export const LIGHTING_CONFIG = {
  AMBIENT: {
    color: 0xffffff,
    intensity: 0.3  // Exact value from original working implementation
  },
  DIRECTIONAL: {
    color: 0xffffff,
    intensity: 1.4, // Exact value from original working implementation
    position: { x: 1, y: 2, z: 3 }, // Exact position from original working implementation
    shadow: {
      mapSize: { width: 2048, height: 2048 },
      camera: {
        near: 0.5,
        far: 20,
        left: -5,
        right: 5,
        top: 5,
        bottom: -5
      }
    }
  },
  // Rim light with exact settings from the original working implementation
  RIM_LIGHT: {
    color: 0xffffff,
    intensity: 0.4,
    position: { x: -2, y: 0.5, z: -1 }
  }
};
