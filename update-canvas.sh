#!/bin/bash

# Path to the Canvas.svelte file
CANVAS_FILE="/Users/benjamindryden/Desktop/personal/fats-cradle/src/lib/components/Canvas.svelte"

# 1. Update calculateParticleSizes function
sed -i '' '/function calculateParticleSizes/,/}/c\
	// Function to calculate particle sizes based on canvas dimensions\
	function calculateParticleSizes() {\
		if (!canvas) return;\
		\
		// Get dimensions\
		const { width, height } = getContainerDimensions();\
		const baseSize = Math.min(width, height) * 0.01; // Adjust the multiplier as needed\
		\
		// Update base config size values\
		BASE_CONFIG.particleSize = baseSize;\
		BASE_CONFIG.particleWidth = baseSize * 2; // Make it wider\
		BASE_CONFIG.preDrawnParticleSize = baseSize * 1.5; // Adjust as needed\
		\
		// Set canvas dimensions\
		canvas.width = width;\
		canvas.height = height;\
		\
		// Update the environment context with new dimensions\
		updateEnvironment(canvas);\
		\
		// Clear canvas if context exists\
		if (ctx) {\
			ctx.clearRect(0, 0, canvas.width, canvas.height);\
		}\
	}' $CANVAS_FILE

# 2. Modify onMount to initialize environment context
sed -i '' '/onMount/,+5c\
	onMount(() => {\
		// Initialize environment context first\
		if (canvas) {\
			initializeEnvironment(canvas);\
		}\
		\
		// Set up resize observer for more reliable size detection\
		const resizeObserver = new ResizeObserver(() => {\
			calculateParticleSizes();\
		});\
		\
		if (canvas) {\
			resizeObserver.observe(canvas);\
			if (canvas.parentElement) {\
				resizeObserver.observe(canvas.parentElement);\
			}\
		}\
		\
		// Also keep window resize for backward compatibility\
		calculateParticleSizes();\
		window.addEventListener("resize", calculateParticleSizes);\
		\
		if (!canvas) return;' $CANVAS_FILE

# 3. Update cleanup function to disconnect ResizeObserver
sed -i '' '/return () =>/,+4c\
		return () => {\
			// Disconnect resize observer\
			if (resizeObserver) {\
				resizeObserver.disconnect();\
			}\
			window.removeEventListener("resize", resize);\
			window.removeEventListener("resize", calculateParticleSizes);\
			if (animationFrameId) {\
				cancelAnimationFrame(animationFrameId);\
			}' $CANVAS_FILE

echo "Canvas.svelte has been updated with context-based scaling"
