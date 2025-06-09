/**
 * Transition Configuration
 * 
 * Contains constants and configuration related to application transitions.
 * These settings were extracted from the original implementation to ensure
 * exact behavior and timings are maintained.
 */

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
 * Default transition state
 * Initial values for the transition store
 */
export const INITIAL_TRANSITION_STATE = {
  phase: TRANSITION_PHASES.NOT_STARTED,
  progress: 0,               // 0-1: Progress within current phase
  isFirstTransitionComplete: false,
  autoTransitionTriggered: false,
  hasTriggeredTransition: false
};
