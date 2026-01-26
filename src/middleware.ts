/**
 * Middleware for rate limiting, authentication, and request logging
 */

import type { Env, RouteHandler } from './types';
import { errorResponse, getClientIp, extractApiKey, log } from './utils';

/**
 * Rate limiter using in-memory Map (for development)
 * In production, use KV or Durable Objects for distributed rate limiting
 */
class RateLimiter {
	private requests: Map<string, { count: number; resetTime: number }> = new Map();

	isRateLimited(key: string, limit: number, windowMs: number): boolean {
		const now = Date.now();
		const record = this.requests.get(key);

		if (!record || now > record.resetTime) {
			// New window
			this.requests.set(key, {
				count: 1,
				resetTime: now + windowMs,
			});
			return false;
		}

		if (record.count >= limit) {
			return true;
		}

		record.count++;
		return false;
	}

	getRateLimitInfo(key: string, limit: number): { remaining: number; reset: number } {
		const record = this.requests.get(key);
		if (!record) {
			return { remaining: limit, reset: Date.now() + 60000 };
		}
		return {
			remaining: Math.max(0, limit - record.count),
			reset: record.resetTime,
		};
	}
}

const rateLimiter = new RateLimiter();

/**
 * Rate limiting middleware
 */
export function withRateLimit(
	handler: RouteHandler,
	limit: number,
	windowMs: number
): RouteHandler {
	return async (request: Request, env: Env, ctx: ExecutionContext, params?: Record<string, string>) => {
		const clientIp = getClientIp(request);
		const key = `rate_limit:${clientIp}`;

		if (rateLimiter.isRateLimited(key, limit, windowMs)) {
			const info = rateLimiter.getRateLimitInfo(key, limit);
			log('warn', 'Rate limit exceeded', { clientIp, limit });
			return errorResponse(
				'Rate Limit Exceeded',
				`Too many requests. Please try again later.`,
				429,
				{
					limit,
					reset: new Date(info.reset).toISOString(),
				}
			);
		}

		const response = await handler(request, env, ctx, params);

		// Add rate limit headers
		const info = rateLimiter.getRateLimitInfo(key, limit);
		const headers = new Headers(response.headers);
		headers.set('X-RateLimit-Limit', limit.toString());
		headers.set('X-RateLimit-Remaining', info.remaining.toString());
		headers.set('X-RateLimit-Reset', new Date(info.reset).toISOString());

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	};
}

/**
 * Authentication middleware for admin endpoints
 */
export function withAuth(handler: RouteHandler): RouteHandler {
	return async (request: Request, env: Env, ctx: ExecutionContext, params?: Record<string, string>) => {
		const apiKey = extractApiKey(request);

		if (!apiKey) {
			log('warn', 'Missing API key', { path: new URL(request.url).pathname });
			return errorResponse(
				'Unauthorized',
				'API key is required. Please provide a valid API key in the Authorization header or X-API-Key header.',
				401
			);
		}

		// Check against environment variable (set via wrangler secret put ADMIN_API_KEY)
		const validApiKey = env.ADMIN_API_KEY;

		if (!validApiKey) {
			log('error', 'Admin API key not configured');
			return errorResponse(
				'Configuration Error',
				'Admin API key is not configured on the server.',
				500
			);
		}

		if (apiKey !== validApiKey) {
			log('warn', 'Invalid API key', { apiKey: apiKey.substring(0, 8) + '...' });
			return errorResponse(
				'Unauthorized',
				'Invalid API key provided.',
				401
			);
		}

		log('info', 'Admin authentication successful');
		return handler(request, env, ctx, params);
	};
}

/**
 * Logging middleware
 */
export function withLogging(handler: RouteHandler): RouteHandler {
	return async (request: Request, env: Env, ctx: ExecutionContext, params?: Record<string, string>) => {
		const startTime = Date.now();
		const url = new URL(request.url);

		log('info', 'Request received', {
			method: request.method,
			path: url.pathname,
			query: url.search,
			clientIp: getClientIp(request),
		});

		const response = await handler(request, env, ctx, params);
		const duration = Date.now() - startTime;

		log('info', 'Request completed', {
			method: request.method,
			path: url.pathname,
			status: response.status,
			duration: `${duration}ms`,
		});

		return response;
	};
}

/**
 * Error handling middleware
 */
export function withErrorHandling(handler: RouteHandler): RouteHandler {
	return async (request: Request, env: Env, ctx: ExecutionContext, params?: Record<string, string>) => {
		try {
			return await handler(request, env, ctx, params);
		} catch (error) {
			log('error', 'Unhandled error', {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});

			return errorResponse(
				'Internal Server Error',
				'An unexpected error occurred while processing your request.',
				500,
				env.ENVIRONMENT === 'development' && error instanceof Error
					? { message: error.message, stack: error.stack }
					: undefined
			);
		}
	};
}

/**
 * Compose multiple middleware functions
 */
export function compose(...middlewares: ((handler: RouteHandler) => RouteHandler)[]): (handler: RouteHandler) => RouteHandler {
	return (handler: RouteHandler) => {
		return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
	};
}
