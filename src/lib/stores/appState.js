import { writable, derived, get } from 'svelte/store';
import { breakpoint, BREAKPOINTS } from './breakpoint';

// Application states
export const APP_STATES = {
  INITIAL: 'initial',         // Initial load state
  TRANSITIONING: 'transitioning', // During transition animations
  INTERACTIVE: 'interactive'   // Final interactive state
};

// Create the base app state store
const createAppState = () => {
  // Initialize with default values
  const { subscribe, set, update } = writable({
    currentState: APP_STATES.INITIAL,
    transitionPhase: 0,       // 0-3: Not started, Scale, Rotate, Wipe
    transitionProgress: 0,    // 0-1: Progress within current phase
    isFirstTransitionComplete: false,
    autoTransitionTriggered: false,
    hasTriggeredTransition: false
  });

  return {
    subscribe,
    
    // Start the transition sequence
    startTransition: () => update(state => {
      // Only start if we're in the initial state and haven't started yet
      if (state.currentState === APP_STATES.INITIAL && !state.hasTriggeredTransition) {
        return {
          ...state,
          currentState: APP_STATES.TRANSITIONING,
          transitionPhase: 1, // Start at phase 1 (Scale)
          hasTriggeredTransition: true
        };
      }
      return state;
    }),
    
    // Update transition progress
    updateTransitionProgress: (phase, progress) => update(state => ({
      ...state,
      transitionPhase: phase,
      transitionProgress: progress,
      // If we reach phase 3 with progress 1, we're in interactive state
      currentState: (phase === 3 && progress >= 1) ? 
        APP_STATES.INTERACTIVE : APP_STATES.TRANSITIONING
    })),
    
    // Complete the first transition (Scale + Rotate)
    completeFirstTransition: () => update(state => ({
      ...state,
      isFirstTransitionComplete: true
    })),
    
    // Reset to initial state (useful for testing)
    reset: () => set({
      currentState: APP_STATES.INITIAL,
      transitionPhase: 0,
      transitionProgress: 0,
      isFirstTransitionComplete: false,
      autoTransitionTriggered: false,
      hasTriggeredTransition: false
    }),
    
    // Auto-transition for mobile/tablet
    triggerAutoTransitionIfNeeded: () => update(state => {
      const isMobileOrTablet = [
        BREAKPOINTS.MOBILE, 
        BREAKPOINTS.TABLET
      ].includes(get(breakpoint));
      
      // Auto-transition on mobile/tablet if not already triggered
      if (isMobileOrTablet && !state.autoTransitionTriggered) {
        return {
          ...state,
          autoTransitionTriggered: true,
          hasTriggeredTransition: true,
          currentState: APP_STATES.TRANSITIONING,
          transitionPhase: 1 // Start at phase 1 (Scale)
        };
      }
      
      return state;
    })
  };
};

// Create and export the app state store
export const appState = createAppState();

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
