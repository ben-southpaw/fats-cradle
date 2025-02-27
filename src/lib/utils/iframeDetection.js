/**
 * Utilities for handling iframe detection and sizing
 */

/**
 * Detect if the current window is inside an iframe
 * @returns {boolean} True if in an iframe
 */
export function isInIframe() {
  try {
    return window !== window.top;
  } catch (e) {
    // If we can't access window.top due to cross-origin restrictions,
    // we're definitely in an iframe
    return true;
  }
}

/**
 * Get the correct dimensions for the container, handling iframe scenarios
 * @param {HTMLElement|null} canvas - The canvas element
 * @returns {{width: number, height: number}} The container dimensions
 */
export function getAdjustedDimensions(canvas) {
  // Log diagnostic information
  const inIframe = isInIframe();
  console.log('=== IFRAME DETECTION ===');
  console.log('Is in iframe:', inIframe);
  console.log('Window dimensions:', {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight
  });
  console.log('Device pixel ratio:', window.devicePixelRatio);
  
  // If we're in an iframe, use viewport dimensions as they're more reliable
  if (inIframe) {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    
    console.log('Viewport dimensions (iframe):', {
      width: viewportWidth,
      height: viewportHeight
    });
    
    return {
      width: viewportWidth,
      height: viewportHeight
    };
  }
  
  // Standard approach for non-iframe environments
  if (!canvas) {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  
  const container = canvas.parentElement;
  if (!container) {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  
  // Log container dimensions
  const dimensions = {
    width: container.clientWidth,
    height: container.clientHeight
  };
  console.log('Container dimensions:', dimensions);
  console.log('Container computed style:', {
    width: window.getComputedStyle(container).width,
    height: window.getComputedStyle(container).height
  });
  
  return dimensions;
}
