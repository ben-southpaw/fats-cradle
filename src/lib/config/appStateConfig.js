/**
 * Centralized configuration for application state
 * Contains default values and constants used by the app state store
 */

/**
 * Application state constants
 */
export const APP_STATES = {
  INITIAL: 'initial',         // Initial load state
  TRANSITIONING: 'transitioning', // During transition animations
  INTERACTIVE: 'interactive'   // Final interactive state
};

/**
 * Transition phases
 */
export const TRANSITION_PHASES = {
  NOT_STARTED: 0,
  SCALE: 1,
  ROTATE: 2,
  WIPE: 3
};

/**
 * Initial state configuration
 * Default values for the app state store
 */
export const INITIAL_STATE = {
  currentState: APP_STATES.INITIAL,
  transitionPhase: TRANSITION_PHASES.NOT_STARTED,
  transitionProgress: 0,    // 0-1: Progress within current phase
  isFirstTransitionComplete: false,
  autoTransitionTriggered: false,
  hasTriggeredTransition: false
};
