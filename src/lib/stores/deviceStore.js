import { derived, get } from 'svelte/store';
import { breakpoint, BREAKPOINTS } from './breakpoint';

// Derived store for device type information
export const deviceInfo = derived(
  breakpoint,
  $breakpoint => ({
    isMobileOrTablet: [BREAKPOINTS.MOBILE, BREAKPOINTS.TABLET].includes($breakpoint),
    isMobile: $breakpoint === BREAKPOINTS.MOBILE,
    isTablet: $breakpoint === BREAKPOINTS.TABLET,
    isDesktop: $breakpoint === BREAKPOINTS.DESKTOP,
    breakpoint: $breakpoint
  })
);

// Helper function to get scale factors based on device
export function getDeviceScaleFactor(mobileFactor, tabletFactor, desktopFactor) {
  const currentBreakpoint = get(breakpoint);
  
  if (currentBreakpoint === BREAKPOINTS.MOBILE) return mobileFactor;
  if (currentBreakpoint === BREAKPOINTS.TABLET) return tabletFactor;
  return desktopFactor; // Desktop default
}
