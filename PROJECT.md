# Fats Cradle - Interactive Magnadoodle Experience

## Project Overview

An interactive web experience that recreates the behavior of a Magnadoodle toy using modern web technologies. The project will be exported to a Readymag site.

## Technical Stack

- **Framework**: Svelte with Bun
- **3D/Graphics**: Three.js, WebGL
- **Animation**: GSAP
- **Performance**: WebGL for optimal rendering

## Core Features

### Interactive Canvas

- Full-screen interactive canvas implemented as a 3D mesh
- Cursor-based drawing mechanics
- Hexagonal grid system with magnetic properties
- Realistic magnetic particle behavior

### Magnetic System

1. **Particle Grid**
   - Hexagonal grid layout
   - Magnetic specks fill hexagon centers
   - Interactive particle displacement

2. **Drawing Mechanics**
   - Cursor-based drawing
   - Magnetic line effects
   - Particle push/pull behavior
   - Pre-drawn stamp functionality

### Visual Elements

- Pre-drawn text: "multidisciplinary creative" (positioned right and down side)
- Interactive magnetic stamps
- Responsive scaling
- Canvas wipe functionality

### 3D Experience

- Initial full-screen canvas view
- Scroll-triggered animation
- Camera perspective transformation
- 3D rotation to final position

## Technical Requirements

- Responsive design
- WebGL optimization
- Smooth animations and transitions
- Touch/mouse event handling
- Cross-device compatibility

## CRITICAL OPERATIONAL DIRECTIVES

   A. Documentation First

- ALWAYS review relevant documentation before proposing or making changes
- If documentation is unclear or incomplete, request clarification
- Consider documentation as the source of truth for design decisions
- If changes might impact existing features, highlight this and ask for approval
- Maintain backward compatibility unless explicitly directed otherwise
- After implementing changes:
     1. Update relevant documentation, add to this document larger changes
     2. Add new learnings
     3. Update examples if needed
     4. Verify documentation consistency

 E. Knowledge Persistence

- IMMEDIATELY document any discovered issues or bugs in gotchas.md
  - ADD learned optimizations or improvements to gotchas.md
  - RECORD all edge cases and their solutions

  - MAINTAIN a session-persistent memory of:
    - Discovered bugs and their fixes
    - Performance optimizations
    - Edge cases and solutions
    - Implementation insights
    - State-specific rule nuances
  - Before suggesting solutions:
     1. Check if similar issues were previously addressed
     2. Review documented solutions and learnings
     3. Apply accumulated knowledge to prevent repeated issues
     4. Build upon previous optimizations
  - After resolving issues:
     1. Document the root cause
     2. Record the solution and rationale
     3. Update relevant documentation
     4. Add prevention strategies to gotchas.md
