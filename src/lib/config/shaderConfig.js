/**
 * Configuration file for WebGL shaders used in the application
 * Extracted from Canvas.svelte to centralize shader code
 */

/**
 * Main vertex shader for rendering particles
 */
export const VERTEX_SHADER = `#version 300 es
  in vec2 position;
  in vec4 color;
  uniform vec2 resolution;
  out vec4 vColor;
  out vec2 vPosition;
  
  void main() {
    // Convert from pixel coordinates to clip space
    vec2 zeroToOne = position / resolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    vec2 clipSpace = zeroToTwo - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    
    // Pass through position for grid calculations
    vPosition = position;
    
    // Set point size based on screen resolution
    gl_PointSize = 2.0 * (resolution.y / 1080.0);
    
    vColor = color;
  }
`;

/**
 * Main fragment shader for rendering particles with hexagonal grid
 */
export const FRAGMENT_SHADER = `#version 300 es
  precision highp float;
  
  in vec4 vColor;
  in vec2 vPosition;
  uniform vec2 resolution;
  uniform float hexSize;
  out vec4 fragColor;

  float distToHexGrid(vec2 p) {
    float size = hexSize * 3.0;
    float hexWidth = size * 2.0; // Width of a hexagon
    float hexHeight = size * sqrt(3.0); // Height of a hexagon
    
    // Calculate grid position
    float horizontalSpacing = hexWidth * 0.75;
    float verticalSpacing = hexHeight;
    
    // Find the nearest hexagon center
    float col = floor(p.x / horizontalSpacing);
    float row = floor(p.y / verticalSpacing);
    
    // Calculate center of nearest hexagon
    vec2 center = vec2(
      col * horizontalSpacing,
      row * verticalSpacing + mod(col, 2.0) * (verticalSpacing / 2.0)
    );
    
    // Calculate distances to all edges of this hexagon
    float minDist = 1000.0;
    for (int i = 0; i < 6; i++) {
      float angle = float(i) * 3.14159 / 3.0;
      vec2 v1 = center + vec2(size * cos(angle), size * sin(angle));
      
      float nextAngle = float(i + 1) * 3.14159 / 3.0;
      vec2 v2 = center + vec2(size * cos(nextAngle), size * sin(nextAngle));
      
      // Calculate distance to line segment
      vec2 edge = v2 - v1;
      float edgeLength = length(edge);
      vec2 edgeDir = edge / edgeLength;
      vec2 toPoint = p - v1;
      
      float proj = dot(toPoint, edgeDir);
      vec2 closest;
      if (proj <= 0.0) {
        closest = v1;
      } else if (proj >= edgeLength) {
        closest = v2;
      } else {
        closest = v1 + edgeDir * proj;
      }
      
      float dist = length(p - closest);
      minDist = min(minDist, dist);
    }
    
    // Also check adjacent hexagons for closer edges
    for (int dx = -1; dx <= 1; dx++) {
      for (int dy = -1; dy <= 1; dy++) {
        if (dx == 0 && dy == 0) continue;
        
        vec2 adjCenter = center + vec2(
          float(dx) * horizontalSpacing,
          float(dy) * verticalSpacing + 
          (mod(col + float(dx), 2.0) - mod(col, 2.0)) * (verticalSpacing / 2.0)
        );
        
        for (int i = 0; i < 6; i++) {
          float angle = float(i) * 3.14159 / 3.0;
          vec2 v1 = adjCenter + vec2(size * cos(angle), size * sin(angle));
          
          float nextAngle = float(i + 1) * 3.14159 / 3.0;
          vec2 v2 = adjCenter + vec2(size * cos(nextAngle), size * sin(nextAngle));
          
          vec2 edge = v2 - v1;
          float edgeLength = length(edge);
          vec2 edgeDir = edge / edgeLength;
          vec2 toPoint = p - v1;
          
          float proj = dot(toPoint, edgeDir);
          vec2 closest;
          if (proj <= 0.0) {
            closest = v1;
          } else if (proj >= edgeLength) {
            closest = v2;
          } else {
            closest = v1 + edgeDir * proj;
          }
          
          float dist = length(p - closest);
          minDist = min(minDist, dist);
        }
      }
    }
    
    return minDist;
  }
  
  void main() {
    // Calculate distance to nearest grid line
    float gridDist = distToHexGrid(vPosition);
    
    // Hard cutoff very close to grid
    if (gridDist < 1.0) {
      discard;
      return;
    }
    
    // Create circular particle with soft edges
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    
    // Smoother transition for anti-aliasing
    float alpha = smoothstep(0.5, 0.3, dist);
    
    // Apply color with adjusted alpha
    fragColor = vec4(vColor.rgb, vColor.a * alpha * 0.8);
  }
`;

/**
 * Grid vertex shader for rendering grid lines
 */
export const GRID_VERTEX_SHADER = `#version 300 es
  in vec2 position;
  uniform vec2 resolution;
  
  void main() {
    // Convert from pixel coordinates to clip space
    vec2 zeroToOne = position / resolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    vec2 clipSpace = zeroToTwo - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  }
`;

/**
 * Grid fragment shader for rendering grid lines
 */
export const GRID_FRAGMENT_SHADER = `#version 300 es
  precision highp float;
  
  uniform vec4 gridColor;
  out vec4 fragColor;
  
  void main() {
    fragColor = gridColor;
  }
`;

/**
 * Texture vertex shader for rendering images and textures
 */
export const TEXTURE_VERTEX_SHADER = `#version 300 es
  in vec2 position;
  in vec2 texCoord;
  uniform vec2 resolution;
  out vec2 vTexCoord;
  
  void main() {
    vec2 zeroToOne = position / resolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    vec2 clipSpace = zeroToTwo - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    vTexCoord = texCoord;
  }
`;

/**
 * Texture fragment shader for rendering images and textures
 */
export const TEXTURE_FRAGMENT_SHADER = `#version 300 es
  precision highp float;
  
  uniform sampler2D uTexture;
  in vec2 vTexCoord;
  out vec4 fragColor;
  
  void main() {
    fragColor = texture(uTexture, vTexCoord);
  }
`;

/**
 * Helper function to create a WebGL shader
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {number} type - The shader type (VERTEX_SHADER or FRAGMENT_SHADER)
 * @param {string} source - The shader source code
 * @returns {WebGLShader} The compiled shader or null if compilation failed
 */
export function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/**
 * Helper function to convert hex color to rgba array
 * @param {string} hex - The hex color string (e.g., "#ff0000")
 * @param {number} alpha - The alpha value (0-1)
 * @returns {Array} - RGBA values as array of floats (0-1)
 */
export function hexToRGBA(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b, alpha];
}
