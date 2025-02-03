/** @type {import('@sveltejs/kit').Handle} */
export const handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Allow embedding from any domain
	response.headers.set('X-Frame-Options', 'ALLOW-FROM *');
	
	// Set Content Security Policy
	response.headers.set(
		'Content-Security-Policy',
		[
			"frame-ancestors *", // Allow embedding in iframes
			"default-src 'self'", // Default to same-origin
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow inline scripts and eval for Three.js
			"style-src 'self' 'unsafe-inline'", // Allow inline styles
			"img-src 'self' data: blob:", // Allow images from same origin, data URIs, and blobs
			"connect-src 'self'", // Allow connections to same origin
		].join('; ')
	);

	// Additional security headers
	response.headers.set('Access-Control-Allow-Origin', '*');
	response.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

	return response;
};
