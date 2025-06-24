import { writable, derived } from 'svelte/store';

// raw stores for width, height, orientation
export const dimensions = writable({ width: 0, height: 0 });
export const orientation = writable('landscape');

// derived booleans
export const isDesktop = derived(
  [dimensions, orientation],
  ([$dimensions, $orientation]) => $orientation === 'landscape' && $dimensions.width >= 1025
);
export const isMobile = derived(isDesktop, ($desktop) => !$desktop);

// update dimensions & orientation in browser
if (typeof window !== 'undefined') {
  const mqlPortrait = window.matchMedia('(orientation: portrait)');
  const mqlLandscape = window.matchMedia('(orientation: landscape)');

  function update() {
    dimensions.set({ width: window.innerWidth, height: window.innerHeight });
    orientation.set(mqlLandscape.matches ? 'landscape' : 'portrait');
  }

  // initial set
  update();
  window.addEventListener('resize', update);
  mqlPortrait.addEventListener('change', update);
  mqlLandscape.addEventListener('change', update);
}
