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

### Multitext Visibility Challenges

### Attempted Approaches

1. Separate MULTITEXT_CONFIG for particle properties

   - Tried using custom config for color, density, and opacity
   - Didn't resolve visibility issues
   - Added complexity without clear benefits

2. Direct Particle Creation
   - Attempted to bypass createParticlesAlongPath
   - Generated points directly from image data
   - Led to reference errors and rendering issues

### Key Learnings

- Keep particle generation consistent across all types (cursor, stamp, multitext)
- Avoid introducing separate configuration objects unless absolutely necessary
- Stick with the existing particle generation pipeline
- Test changes incrementally rather than large refactors

### Next Steps to Consider

- Focus on adjusting existing particle properties rather than creating new systems
- Look into the particle rendering pipeline for visibility improvements
- Consider tweaking opacity and density in the current system

### Magnet Animation

- Magnet rotation is velocity-based during drag
- Drop animation needs special handling:
  - Reset velocity before animation starts
  - Clear any ongoing rotation animations
  - Use non-elastic easing to prevent wobble
  - Consider implementing a "settle" state to prevent micro-movements
- Rotation should be clamped during movement and zeroed on drop
- Multiple concurrent GSAP animations may cause interference

### Rendering Optimizations

- Static particles (predrawn and stamps) are only re-rendered when their count changes
- Uses a safety check comparing current vs last static particle count
- Dynamic particles are still rendered every frame
- Self-healing: will re-render static particles if they change unexpectedly

### Custom Cursor

- Custom cursor starts invisible and fades in on first mousemove
- Uses CSS transitions for smooth opacity animation (0.35s ease)
- Cursor visibility state is tracked separately from opacity
- Maintains all existing cursor positioning and behavior
- Initial opacity is 0 to prevent flash on page load

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

## WebGL Setup and Debugging

1. When using WebGL with Svelte, ensure all helper functions (createShader, createProgram, etc.) are defined before they're used in the setup function
2. Always add the `?url` suffix to image imports when they'll be used as textures
3. WebGL context creation should be wrapped in try-catch blocks to handle potential failures gracefully
4. Use a debug logging system to track WebGL initialization steps and catch issues early
5. When falling back from WebGL2 to WebGL1, maintain consistent context attributes

## Multitext Particle System

1. Multitext particles require specific configuration separate from regular particles
2. Image dimensions should fall back to the source image dimensions if not explicitly set
3. When handling multiple particle types (multitext vs regular), always check the particle type before applying configurations
4. Edge detection for particle placement should consider both the particle type and the image data
5. Maintain separate density and offset configurations for edge vs fill particles

## Particle System Requirements

- Particle randomization vs deterministic patterns:
  - While randomization isn't strictly essential (earlier versions worked without it)
  - Attempted optimization using golden ratio and coordinate-based patterns failed
  - Key learnings:
    - Simple coordinate-based patterns create visible artifacts
    - Complex mathematical patterns (golden ratio) didn't improve visuals
    - Mouse movement alone isn't enough to create natural-looking variation
  - Future optimization attempts should:
    - Reference earlier working deterministic version
    - Avoid overly complex mathematical patterns
    - Test visual quality with different cursor movement speeds
    - Consider hybrid approach (some random, some deterministic)

### Critical Dependencies

- Multitext config must be maintained for proper text rendering
- Cursor transition system relies on specific particle behaviors
- White particle distribution affects overall visual quality
- Random particle generation is essential for natural appearance

### Known Issues

- Attempts to optimize with deterministic patterns can work but need careful implementation
- Performance optimizations must preserve existing functionality
- Changes to particle generation require careful testing of all dependent systems

### Recovery Steps

1. Revert to last known working state if particle system is broken
2. Reinstate multitext config first
3. Restore cursor transition system
4. Only then attempt performance optimizations
5. Test all dependent systems after any changes

## Slider and Wipe Animation

#### Screen Space vs World Space

- Screen space coordinates work better than world space for slider interaction
- Project slider bounds to screen space for accurate mouse position mapping
- Convert back to world space for actual slider movement
- This prevents perspective distortion affecting slider response

#### Drag Interaction

- Store initial click offset from slider center
- Maintain this offset throughout the drag
- Allows dragging from any part of the knob (left, center, right)
- Formula: `dragOffset = event.clientX - sliderScreenX`
- Apply offset during movement: `adjustedX = event.clientX - dragOffset`

#### Wipe Animation

- Wipe progress is inversely proportional to slider position
- Formula: `1 - (x - sliderMinX) / (sliderMaxX - sliderMinX)`
- Dispatch progress updates:
  - Immediately during drag
  - On animation update during scroll
  - Ensures smooth canvas wipe effect

#### Scroll Behavior

- Use GSAP for smooth scroll animation
- Longer duration (0.5s) with power3.out easing
- Debounce scroll updates (16ms) to prevent rapid-fire
- Keep scroll sensitivity low (0.0005) for fine control
- Clean up animations and timeouts on component destroy

#### Slider Bounds

- Hardcoded bounds: `sliderMinX = -1.47, sliderMaxX = 1.47`
- Project these to screen space for accurate interaction
- Clamp all movements within these bounds
- Consider model scale when calculating bounds

#### Key Learnings

1. Screen space coordinates provide more intuitive interaction
2. Maintain drag offset for natural knob movement
3. Separate immediate (drag) and animated (scroll) updates
4. Clean up all animations and timeouts
5. Use appropriate easing for smooth movement
6. Dispatch progress updates consistently for smooth wipe effect

## Iframe Embedding

### Security Headers

- Site requires specific headers in `hooks.server.js` for iframe embedding:
  - X-Frame-Options: ALLOW-FROM \*
  - Content-Security-Policy with frame-ancestors
  - Cross-Origin-Resource-Policy for resource sharing
  - Access-Control-Allow-Origin for CORS

### Content Security Policy

- CSP needs to allow:
  - Inline scripts and eval for Three.js functionality
  - Inline styles for dynamic styling
  - Data URIs and blobs for image handling
  - Same-origin connections for API calls

### Responsive Considerations

- Canvas and Three.js scene use viewport units (100vh)
- Touch events work within iframe context
- Mouse position calculations remain accurate in iframe
- Scroll-to-explore component may need adjustment if iframe is in scrolling page
