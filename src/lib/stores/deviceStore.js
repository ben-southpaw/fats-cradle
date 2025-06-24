import { derived, get } from 'svelte/store';
import { isDesktop } from '$lib/stores/breakpoint';

// Derived store for device type information
export const deviceInfo = derived(
  [isDesktop],
  ($isDesktop) => ({
    isMobileOrTablet: !$isDesktop,
    isMobile: !$isDesktop,
    isTablet: false,
    isDesktop: $isDesktop,
    breakpoint: $isDesktop ? 'desktop' : 'mobile'
  })
);

// Helper function to get scale factors based on device
export function getDeviceScaleFactor(mobileFactor, tabletFactor, desktopFactor) {
  const desktop = get(isDesktop);
  return desktop ? desktopFactor : mobileFactor;
}
