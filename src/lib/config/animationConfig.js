/**
 * Animation Configuration
 * Centralized configuration for animation timings, delays, and behaviors
 */

/**
 * Main transition animation configuration
 */
export const TRANSITION_ANIMATION = {
  // Duration of the main animation sequence (in seconds)
  DURATION: 2.0,
  
  // Delay before starting the animation (in seconds)
  DELAY: 0.5,
  
  // Fade in delay after transition (in seconds)
  FADE_DELAY: 0.2,
  
  // Easing functions
  EASE: {
    STANDARD: 'power2.inOut',
    SMOOTH: 'power1.out',
    BOUNCE: 'elastic.out(1, 0.3)'
  }
};

/**
 * Wipe animation configuration
 */
export const WIPE_ANIMATION = {
  // Delay before wipe effect starts (in seconds)
  DELAY: 2.0,
  
  // Duration of the quick spin before wipe (in seconds)
  SPIN_DURATION: 0.8,  // 40% of standard duration
  
  // Duration of the wipe effect itself (in seconds)
  WIPE_DURATION: 1.2,  // 60% of standard duration
};

/**
 * Slider animation configuration
 */
export const SLIDER_ANIMATION = {
  // Delay before slider movement (in seconds)
  DELAY: 0.4,
  
  // Duration of slider animation (in seconds)
  DURATION: 1.6,
  
  // Snap back configuration
  SNAP_BACK: {
    DELAY: 0,
    DURATION: 0.3
  }
};

/**
 * ScrollToExplore animation configuration
 */
export const SCROLL_ANIMATION = {
  // Fade in/out duration (in seconds)
  FADE_DURATION: 0.3,
  
  // Fade out delay when transitioning (in seconds)
  FADE_OUT_DELAY: 0.5
};

/**
 * Global animation helper functions
 */
export const AnimationHelpers = {
  /**
   * Get a device-appropriate animation duration
   * @param {number} baseDuration - The standard duration for desktop
   * @returns {number} - Adjusted duration based on device type
   */
  getDeviceAdjustedDuration(baseDuration) {
    // These can be enhanced with deviceInfo from appState
    // For now using simple detection
    const isMobile = window.innerWidth <= 768;
    const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;
    
    if (isMobile) return baseDuration * 0.8; // Slightly faster on mobile
    if (isTablet) return baseDuration * 0.9; // Slightly faster on tablet
    return baseDuration; // Standard on desktop
  }
};
