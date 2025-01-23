# WebGL and Canvas Insights

## Process Guidelines
- Always check for existing variables before suggesting new ones
- Never make design decisions or changes without explicit consent
- When improvements are possible:
  1. Suggest the improvement with clear rationale
  2. Wait for approval before implementing
  3. Document the decision once approved
- Maintain existing functionality unless explicitly asked to change

## Variable Context
- Pay special attention to existing variable scope and usage
- Check all related files for variable definitions before suggesting new ones
- Consider the full component context when discussing changes
- Document variable dependencies and relationships

## Performance Considerations
- Canvas uses WebGL for optimal performance with particle systems
- Particle batching is implemented to reduce draw calls
- Custom shader programs are used for efficient texture rendering
- Magnetic effects use pre-drawn elements to reduce runtime calculations

## Implementation Details
- Cursor position requires specific offsets (X: 0.62, Y: 0.42) for accurate interaction
- Letter heights are grouped into categories (high, middle) for consistent vertical alignment
- Collision detection uses a 0.9 scale factor for more natural-feeling interactions
- Particle density and size are configurable via CONFIG object for easy tuning

## State Management
- Magnet positions are tracked for restoration
- Render requests are debounced to prevent unnecessary redraws
- Animation frames are properly cleaned up on component destruction

## Critical Dependencies
- GSAP for smooth animations
- Three.js for 3D scene management
- PixiJS for 2D graphics support
- Lottie for vector animations

## Edge Cases
- Image loading states need to be checked before stamp creation
- Magnet stamping operations should be prevented while already in progress
- WebGL context loss needs to be handled gracefully