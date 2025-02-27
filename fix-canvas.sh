#!/bin/bash

# Path to the Canvas.svelte file
CANVAS_FILE="/Users/benjamindryden/Desktop/personal/fats-cradle/src/lib/components/Canvas.svelte"

# Use a clean approach by writing to a temporary file first
cp $CANVAS_FILE ${CANVAS_FILE}.bak

# Insert calculateParticleSizes function correctly
sed -i '' 's/function calculateParticleSizes() {/function calculateParticleSizes() {\
		if (!canvas) return;\
\
		const { width, height } = getContainerDimensions();\
		const baseSize = Math.min(width, height) * 0.01; \
\
		BASE_CONFIG.particleSize = baseSize;\
		BASE_CONFIG.particleWidth = baseSize * 2; \
		BASE_CONFIG.preDrawnParticleSize = baseSize * 1.5;\
\
		canvas.width = width;\
		canvas.height = height;\
\
		updateEnvironment(canvas);\
\
		if (ctx) {\
			ctx.clearRect(0, 0, canvas.width, canvas.height);\
		}\
	}/g' $CANVAS_FILE

# Fix any duplicated lines
sed -i '' '/		const baseSize = Math.min(width, height)/,/BASE_CONFIG.preDrawnParticleSize = baseSize/d' $CANVAS_FILE

# Fix the onMount function
sed -i '' 's/onMount(() => {/onMount(() => {\
		if (canvas) { initializeEnvironment(canvas); }\
\
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
/g' $CANVAS_FILE

# Fix the cleanup function
sed -i '' 's/return () => {/return () => {\
			if (resizeObserver) {\
				resizeObserver.disconnect();\
			}\
/g' $CANVAS_FILE

echo "Canvas.svelte has been fixed"
