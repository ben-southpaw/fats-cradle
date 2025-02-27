/**
 * Utility functions for diagnosing iframe and scaling issues
 */

/**
 * Log information about the current environment
 */
export function logEnvironmentInfo() {
  console.log('=== ENVIRONMENT DIAGNOSTICS ===');
  console.log('Is in iframe:', window !== window.top);
  console.log('Window dimensions:', {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight
  });
  console.log('Device pixel ratio:', window.devicePixelRatio);
  console.log('User agent:', navigator.userAgent);
  
  // Document and viewport info
  console.log('Document dimensions:', {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight
  });
  
  // CSS environment
  const computedStyle = window.getComputedStyle(document.documentElement);
  console.log('CSS Environment:', {
    fontSize: computedStyle.fontSize,
    rem: parseFloat(computedStyle.fontSize),
    vh: window.innerHeight / 100,
    vw: window.innerWidth / 100
  });
}

/**
 * Log information about a specific element
 */
export function logElementInfo(element, label = 'Element') {
  if (!element) {
    console.log(`${label}: Element is null or undefined`);
    return;
  }
  
  console.log(`=== ${label.toUpperCase()} DIAGNOSTICS ===`);
  
  // Element dimensions
  console.log(`${label} dimensions:`, {
    clientWidth: element.clientWidth,
    clientHeight: element.clientHeight,
    offsetWidth: element.offsetWidth,
    offsetHeight: element.offsetHeight,
    scrollWidth: element.scrollWidth,
    scrollHeight: element.scrollHeight,
    getBoundingClientRect: {
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
      top: element.getBoundingClientRect().top,
      left: element.getBoundingClientRect().left
    }
  });
  
  // Computed style
  const computedStyle = window.getComputedStyle(element);
  console.log(`${label} computed style:`, {
    width: computedStyle.width,
    height: computedStyle.height,
    position: computedStyle.position,
    display: computedStyle.display,
    boxSizing: computedStyle.boxSizing,
    padding: `${computedStyle.paddingTop} ${computedStyle.paddingRight} ${computedStyle.paddingBottom} ${computedStyle.paddingLeft}`,
    margin: `${computedStyle.marginTop} ${computedStyle.marginRight} ${computedStyle.marginBottom} ${computedStyle.marginLeft}`,
    border: `${computedStyle.borderTopWidth} ${computedStyle.borderRightWidth} ${computedStyle.borderBottomWidth} ${computedStyle.borderLeftWidth}`
  });
}

/**
 * Log scaling calculation information
 */
export function logScalingInfo(width, height, baseSize, scale) {
  console.log('=== SCALING DIAGNOSTICS ===');
  console.log('Dimensions for scaling:', { width, height });
  console.log('Base size:', baseSize);
  console.log('Scale factor:', scale);
}
