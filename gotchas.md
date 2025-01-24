# WebGL and Canvas Insights

## Process Guidelines

- Always check for existing variables before suggesting new ones

- Never make design decisions or changes without explicit consent

- When improvements are possible:

1. Suggest the improvement with clear rationale

2. Wait for approval before implementing

3. Document the decision once approved

4. Always update this document if we have an error

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

## ThreeScene Component

### Magnet Sizing

- Magnet dimensions in the 3D scene should be based on canvas width only, not height

- Each letter has a specific aspect ratio that must be maintained:

- F, T, E: 0.7272 (400/550)

- A, A2: 0.8181 (450/550)

- M: 1.1818 (650/550)

- Base size is calculated as 15% of canvas width to maintain consistent proportions

- This prevents vertical stretching while keeping magnets properly sized relative to the screen

### Image Loading

- Always use Vite's URL imports for images (`import img from '$lib/images/img.png?url'`)

- Never use absolute paths like '/images/img.png' as they will 404 in development

- Store imported URLs at module scope, not inside functions

- Image-related variables (textures, loaders) should be at module scope

### Variable Scope

- Keep shared variables at module scope to prevent redeclaration errors

- Texture-related objects (magnetTextures, textureLoader) must persist between renders

- Use `let` for objects that will be modified (e.g., magnets object)

- Initialize collections (maps, objects) at module scope to prevent undefined errors

## Canvas Component

### Magnet Initialization

- Magnet dimensions must be set before accessing in createPreDrawnElements
- Use existing magnet.img instead of creating new Image instance
- Check for magnet.img.complete before processing
- Set width/height on magnet object if not already set

### Multitext Configuration

- Multitext elements use custom configuration separate from regular stamps
- Key configuration areas:
  - Particle density (edge and fill rates)
  - Random offset controls for particle placement
  - Proximity threshold for particle spacing
  - Custom positioning with percentage-based offsets
  - Appearance settings for colors and opacity

### Multitext Appearance

- Uses darker base color (#1a1a1a) for better contrast
- Reduced white particle probability (15%) for cleaner look
- Higher opacity values for both initial and subsequent stamps
- Custom white particle color (#e6e6e6) for subtle variation
- Tighter particle clustering on edges (0 random offset)
- More spread in fill areas (1.8 random offset)

### Magnet Animation

- Magnet rotation is velocity-based during drag
- Drop animation needs special handling:
  - Reset velocity before animation starts
  - Clear any ongoing rotation animations
  - Use non-elastic easing to prevent wobble
  - Consider implementing a "settle" state to prevent micro-movements
- Rotation should be clamped during movement and zeroed on drop
- Multiple concurrent GSAP animations may cause interference

### Event Listeners

- Always clean up timeouts in component destroy/unmount

- Use window.addEventListener for global events

- Prefer passive event listeners for scroll/wheel events

- Avoid mixing jQuery with native DOM events

## Svelte Best Practices

### DOM References

- Use `bind:this` for DOM element references instead of jQuery

- Prefer Svelte bindings over manual DOM manipulation

- Wait for component mount before accessing bound elements

- Clean up any event listeners or timeouts in onDestroy
