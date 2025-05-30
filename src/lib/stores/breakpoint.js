import { writable } from 'svelte/store';

// Define breakpoints
export const BREAKPOINTS = {
  MOBILE: 'mobile',    // up to 767px
  TABLET: 'tablet',    // 768px to 1023px
  DESKTOP: 'desktop',  // 1024px and above
};

// Create a writable store with initial value
export const breakpoint = writable(BREAKPOINTS.DESKTOP); // Default value, will be updated immediately

// Create a store for dimensions
export const dimensions = writable({ width: 0, height: 0 });

// Initialize the breakpoint detection if we're in a browser environment
if (typeof window !== 'undefined') {
  // Function to determine breakpoint based on width
  const getBreakpoint = (width) => {
    if (width < 768) return BREAKPOINTS.MOBILE;
    if (width < 1024) return BREAKPOINTS.TABLET;
    return BREAKPOINTS.DESKTOP;
  };

    // Track previous breakpoint for change detection
  let previousBreakpoint = getBreakpoint(window.innerWidth);

  // Function to handle breakpoint changes
  const handleBreakpointChange = (newBreakpoint) => {
    if (previousBreakpoint !== newBreakpoint) {
      // Only refresh if we're crossing between different breakpoint categories
      const isDesktopToMobile = (previousBreakpoint === BREAKPOINTS.DESKTOP && 
                               (newBreakpoint === BREAKPOINTS.TABLET || newBreakpoint === BREAKPOINTS.MOBILE));
      const isTabletToMobile = (previousBreakpoint === BREAKPOINTS.TABLET && 
                               newBreakpoint === BREAKPOINTS.MOBILE);
      const isMobileToTablet = (previousBreakpoint === BREAKPOINTS.MOBILE && 
                               newBreakpoint === BREAKPOINTS.TABLET);
      const isToDesktop = (newBreakpoint === BREAKPOINTS.DESKTOP && 
                          previousBreakpoint !== BREAKPOINTS.DESKTOP);

      if (isDesktopToMobile || isTabletToMobile || isMobileToTablet || isToDesktop) {
        // Small delay to ensure all resize handlers have run
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
      
      previousBreakpoint = newBreakpoint;
    }
  };

  // Function to update the store based on media query matches
  const updateBreakpoint = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Update dimensions store
    dimensions.set({ width, height });
    
    // Get the new breakpoint
    const newBreakpoint = getBreakpoint(width);
    
    // Update breakpoint store
    breakpoint.set(newBreakpoint);
    
    // Handle breakpoint changes
    handleBreakpointChange(newBreakpoint);
    
    // Log the current dimensions and breakpoint (as requested)
    console.log(`Browser dimensions: ${width}x${height}, Breakpoint: ${newBreakpoint}`);
  };

  // Initial update
  updateBreakpoint();

  // Add resize listener
  window.addEventListener('resize', updateBreakpoint);
}
