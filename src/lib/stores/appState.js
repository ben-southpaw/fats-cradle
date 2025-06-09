import { writable } from 'svelte/store';
import { APP_STATES, TRANSITION_PHASES, INITIAL_STATE } from '$lib/config/appStateConfig';

// Re-export APP_STATES for backwards compatibility
export { APP_STATES };

// Create the base app state store
const createAppState = () => {
  // Initialize with default values from config
  const { subscribe, set, update } = writable({ ...INITIAL_STATE });

  return {
    subscribe,
    
    // Start the transition sequence
    startTransition: () => update(state => {
      // Only start if we're in the initial state and haven't started yet
      if (state.currentState === APP_STATES.INITIAL && !state.hasTriggeredTransition) {
        return {
          ...state,
          currentState: APP_STATES.TRANSITIONING,
          transitionPhase: TRANSITION_PHASES.SCALE,
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
      // If we reach WIPE phase with progress 1, we're in interactive state
      currentState: (phase === TRANSITION_PHASES.WIPE && progress >= 1) ? 
        APP_STATES.INTERACTIVE : APP_STATES.TRANSITIONING
    })),
    
    // Complete the first transition (Scale + Rotate)
    completeFirstTransition: () => update(state => ({
      ...state,
      isFirstTransitionComplete: true
    })),
    
    // Reset to initial state (useful for testing)
    reset: () => set({ ...INITIAL_STATE }),
    
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
          transitionPhase: TRANSITION_PHASES.SCALE
        };
      }
      
      return state;
    })
  };
};

// Create and export the app state store
export const appState = createAppState();
