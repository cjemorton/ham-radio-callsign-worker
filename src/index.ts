/**
 * Ham Radio Callsign Worker - Entry Point
 *
 * This Cloudflare Worker provides API endpoints for ham radio callsign lookups,
 * database management, and administrative functions.
 */

import type { Env } from './types';
import { Router } from './router';
import { withRateLimit, withAuth, withLogging, withErrorHandling, compose } from './middleware';
import { jsonResponse, errorResponse } from './utils';
import * as userHandlers from './handlers/user';
import * as adminHandlers from './handlers/admin';

// Export types for external use
export type { Env } from './types';

/**
 * Initialize the router with all endpoints
 */
function createRouter(): Router {
	const router = new Router();

	// Health check endpoint (no rate limiting for monitoring)
	router.get('/', async (_request: Request, env: Env) => {
		return jsonResponse({
			status: 'ok',
			service: 'ham-radio-callsign-worker',
			version: '0.1.0',
			environment: env.ENVIRONMENT || 'development',
			timestamp: new Date().toISOString(),
		});
	});

	router.get('/health', async (_request: Request, env: Env) => {
		return jsonResponse({
			status: 'ok',
			service: 'ham-radio-callsign-worker',
			version: '0.1.0',
			environment: env.ENVIRONMENT || 'development',
			timestamp: new Date().toISOString(),
		});
	});

	// Version endpoint
	router.get('/version', async () => {
		return jsonResponse({
			version: '0.1.0',
			api_version: 'v1',
			timestamp: new Date().toISOString(),
		});
	});

	// User API endpoints (with rate limiting: 100 requests per minute)
	const userMiddleware = compose(
		withErrorHandling,
		withLogging,
		(handler) => withRateLimit(handler, 100, 60000)
	);

	router.get('/api/v1/callsign/:callsign', userMiddleware(userHandlers.getCallsign));
	router.get('/api/v1/search', userMiddleware(userHandlers.searchCallsigns));
	router.get('/api/v1/export', userMiddleware(userHandlers.exportDatabase));

	// Admin API endpoints (with authentication and stricter rate limiting: 20 requests per minute)
	const adminMiddleware = compose(
		withErrorHandling,
		withLogging,
		(handler) => withRateLimit(handler, 20, 60000),
		withAuth
	);

	router.post('/admin/update', adminMiddleware(adminHandlers.forceUpdate));
	router.post('/admin/rebuild', adminMiddleware(adminHandlers.rebuildDatabase));
	router.post('/admin/rollback', adminMiddleware(adminHandlers.rollbackDatabase));
	router.get('/admin/logs', adminMiddleware(adminHandlers.getLogs));
	router.get('/admin/metadata', adminMiddleware(adminHandlers.getMetadata));
	router.get('/admin/stats', adminMiddleware(adminHandlers.getStats));

	return router;
}

/**
 * Main worker entry point
 */
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const router = createRouter();
		const response = await router.handle(request, env, ctx);

		// If no route matched, return 404
		if (!response) {
			const url = new URL(request.url);
			return errorResponse(
				'Not Found',
				'The requested resource was not found',
				404,
				{ path: url.pathname }
			);
		}

		return response;
	},
};
