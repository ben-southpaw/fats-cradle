import { APP_STATES } from '$lib/config/appStateConfig';
import { transitionStore, transitionAppState } from './transitionStore';

// Re-export APP_STATES for backwards compatibility
export { APP_STATES };

/**
 * Create the app state store that integrates with the transition store
 * This maintains the exact same API and behavior as the original implementation
 * for backward compatibility, while delegating transition logic to transitionStore
 */
const createAppState = () => {
  return {
    subscribe: transitionAppState.subscribe,
    
    // Start the transition sequence - delegates to transitionStore
    startTransition: () => {
      transitionStore.start();
    },
    
    // Update transition progress - delegates to transitionStore
    updateTransitionProgress: (phase, progress) => {
      transitionStore.updateProgress(phase, progress);
    },
    
    // Complete the first transition - delegates to transitionStore
    completeFirstTransition: () => {
      transitionStore.completeFirstTransition();
    },
    
    // Reset to initial state - delegates to transitionStore
    reset: () => {
      transitionStore.reset();
    },
    
    // Auto-transition for mobile/tablet - delegates to transitionStore
    triggerAutoTransitionIfNeeded: () => {
      transitionStore.triggerAutoTransitionIfNeeded();
    }
  };
};

// Create and export the app state store
export const appState = createAppState();
