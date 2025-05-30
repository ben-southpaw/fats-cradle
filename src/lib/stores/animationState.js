import { writable, derived } from 'svelte/store';

// Define animation states as constants
export const ANIMATION_STATES = {
  LANDING: 'landing',         // Initial landing state
  SCROLL_TRANSITION: 'scroll_transition',  // During first scroll transition
  SCROLL_COMPLETE: 'scroll_complete',      // After first transition is complete
  DRAG_TRANSITION: 'drag_transition',      // During drag transition
  DRAG_COMPLETE: 'drag_complete'           // After drag transition is complete
};

// Create the base animation state store
const createAnimationState = () => {
  // Initial state
  const initialState = {
    currentState: ANIMATION_STATES.LANDING,
    transitionProgress: 0,         // Progress of current transition (0-1)
    isTransitioning: false,        // Whether any animation is in progress
    sliderPosition: 0,             // Current slider position (0-1)
    modelRotation: { x: 0, y: 0 }, // Current model rotation
  };
  
  const { subscribe, set, update } = writable(initialState);
  
  return {
    subscribe,
    
    // Set the animation state
    setState: (newState) => update(state => ({
      ...state,
      currentState: newState,
    })),
    
    // Update transition progress
    setProgress: (progress) => update(state => ({
      ...state,
      transitionProgress: progress,
    })),
    
    // Set whether we're transitioning
    setTransitioning: (isTransitioning) => update(state => ({
      ...state,
      isTransitioning,
    })),
    
    // Update slider position
    setSliderPosition: (position) => update(state => ({
      ...state,
      sliderPosition: position,
    })),
    
    // Update model rotation
    setModelRotation: (rotation) => update(state => ({
      ...state,
      modelRotation: rotation,
    })),
    
    // Start scroll transition
    startScrollTransition: () => update(state => ({
      ...state,
      currentState: ANIMATION_STATES.SCROLL_TRANSITION,
      isTransitioning: true,
    })),
    
    // Complete scroll transition
    completeScrollTransition: () => update(state => ({
      ...state,
      currentState: ANIMATION_STATES.SCROLL_COMPLETE,
      isTransitioning: false,
    })),
    
    // Start drag transition
    startDragTransition: () => update(state => ({
      ...state,
      currentState: ANIMATION_STATES.DRAG_TRANSITION,
      isTransitioning: true,
    })),
    
    // Complete drag transition
    completeDragTransition: () => update(state => ({
      ...state,
      currentState: ANIMATION_STATES.DRAG_COMPLETE,
      isTransitioning: false,
    })),
    
    // Reset to initial state
    reset: () => set(initialState),
  };
};

// Create and export the store
export const animationState = createAnimationState();

// Derived stores for convenience
export const currentAnimationState = derived(
  animationState,
  $state => $state.currentState
);

export const isTransitioning = derived(
  animationState,
  $state => $state.isTransitioning
);

export const transitionProgress = derived(
  animationState,
  $state => $state.transitionProgress
);

export const sliderPosition = derived(
  animationState,
  $state => $state.sliderPosition
);

// Helper derived stores for state checks
export const isLandingState = derived(
  currentAnimationState,
  $state => $state === ANIMATION_STATES.LANDING
);

export const isScrollTransition = derived(
  currentAnimationState,
  $state => $state === ANIMATION_STATES.SCROLL_TRANSITION
);

export const isScrollComplete = derived(
  currentAnimationState,
  $state => $state === ANIMATION_STATES.SCROLL_COMPLETE
);

export const isDragTransition = derived(
  currentAnimationState,
  $state => $state === ANIMATION_STATES.DRAG_TRANSITION
);

export const isDragComplete = derived(
  currentAnimationState,
  $state => $state === ANIMATION_STATES.DRAG_COMPLETE
);
