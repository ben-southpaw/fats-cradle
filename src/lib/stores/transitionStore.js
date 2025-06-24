import { writable, derived, get } from 'svelte/store';
import { TRANSITION_PHASES, INITIAL_TRANSITION_STATE } from '$lib/config/transitionConfig';
import { isMobile } from '$lib/stores/breakpoint';
import { APP_STATES } from '$lib/config/appStateConfig';

/**
 * Creates and configures the transition store
 * This store manages all transition-related state and logic
 */
const createTransitionStore = () => {
  // Initialize with default values from config
  const { subscribe, set, update } = writable({ ...INITIAL_TRANSITION_STATE });

  return {
    subscribe,
    
    /**
     * Start the transition sequence
     * Only starts if we haven't triggered a transition yet
     */
    start: () => update(state => {
      if (!state.hasTriggeredTransition) {
        return {
          ...state,
          phase: TRANSITION_PHASES.SCALE,
          hasTriggeredTransition: true
        };
      }
      return state;
    }),
    
    /**
     * Update transition progress for a specific phase
     * @param {number} phase - The current transition phase
     * @param {number} progress - Progress value from 0-1
     */
    updateProgress: (phase, progress) => update(state => ({
      ...state,
      phase,
      progress
    })),
    
    /**
     * Complete the first transition (Scale + Rotate)
     * This is used to track transition progress separately from phase
     */
    completeFirstTransition: () => update(state => ({
      ...state,
      isFirstTransitionComplete: true
    })),
    
    /**
     * Reset to initial state (useful for testing)
     */
    reset: () => set({ ...INITIAL_TRANSITION_STATE }),
    
    /**
     * Auto-transition for mobile/tablet
     * Automatically triggers transition on mobile/tablet devices
     */
    triggerAutoTransitionIfNeeded: () => update(state => {
      const isMobileOrTablet = get(isMobile);
      
      // Auto-transition on mobile/tablet if not already triggered
      if (isMobileOrTablet && !state.autoTransitionTriggered) {
        return {
          ...state,
          autoTransitionTriggered: true,
          hasTriggeredTransition: true,
          phase: TRANSITION_PHASES.SCALE
        };
      }
      
      return state;
    })
  };
};

// Create and export the transition store
export const transitionStore = createTransitionStore();

/**
 * Derived store that maps transition state to app state
 * This preserves the exact same behavior as the original implementation
 */
export const transitionAppState = derived(
  transitionStore,
  $transitionStore => {
    // Determine app state based on transition phase and progress
    let currentState = APP_STATES.INITIAL;
    
    if ($transitionStore.hasTriggeredTransition) {
      currentState = APP_STATES.TRANSITIONING;
      
      // If we reach WIPE phase with progress 1, we're in interactive state
      if ($transitionStore.phase === TRANSITION_PHASES.WIPE && $transitionStore.progress >= 1) {
        currentState = APP_STATES.INTERACTIVE;
      }
    }

    // Return complete state object that mimics the original app state structure
    return {
      currentState,
      transitionPhase: $transitionStore.phase,
      transitionProgress: $transitionStore.progress,
      isFirstTransitionComplete: $transitionStore.isFirstTransitionComplete,
      autoTransitionTriggered: $transitionStore.autoTransitionTriggered,
      hasTriggeredTransition: $transitionStore.hasTriggeredTransition
    };
  }
);
