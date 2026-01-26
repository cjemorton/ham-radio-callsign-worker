/**
 * Router for handling HTTP requests
 */

import type { Route, RouteHandler, Env } from './types';
import { handleOptions } from './utils';

/**
 * Simple path-to-regex converter with parameter extraction
 */
function pathToRegex(path: string): { pattern: RegExp; paramNames: string[] } {
	const paramNames: string[] = [];
	const regexPattern = path
		.replace(/\//g, '\\/')
		.replace(/:([^/]+)/g, (_match, paramName) => {
			paramNames.push(paramName);
			return '([^/]+)';
		});

	return {
		pattern: new RegExp(`^${regexPattern}$`),
		paramNames,
	};
}

/**
 * Router class for managing routes
 */
export class Router {
	private routes: Route[] = [];

	/**
	 * Add a route to the router
	 */
	add(method: string, path: string, handler: RouteHandler): void {
		const { pattern, paramNames } = pathToRegex(path);
		this.routes.push({
			method: method.toUpperCase(),
			pattern,
			handler,
			paramNames,
		});
	}

	/**
	 * Convenience methods for common HTTP methods
	 */
	get(path: string, handler: RouteHandler): void {
		this.add('GET', path, handler);
	}

	post(path: string, handler: RouteHandler): void {
		this.add('POST', path, handler);
	}

	put(path: string, handler: RouteHandler): void {
		this.add('PUT', path, handler);
	}

	delete(path: string, handler: RouteHandler): void {
		this.add('DELETE', path, handler);
	}

	/**
	 * Handle incoming requests
	 */
	async handle(request: Request, env: Env, ctx: ExecutionContext): Promise<Response | null> {
		const url = new URL(request.url);
		const method = request.method;

		// Handle CORS preflight
		if (method === 'OPTIONS') {
			return handleOptions();
		}

		// Find matching route
		for (const route of this.routes) {
			if (route.method !== method) {
				continue;
			}

			const match = url.pathname.match(route.pattern);
			if (match) {
				// Extract parameters
				const params: Record<string, string> = {};
				if (route.paramNames && route.paramNames.length > 0) {
					route.paramNames.forEach((name, index) => {
						params[name] = match[index + 1];
					});
				}

				return route.handler(request, env, ctx, params);
			}
		}

		// No route matched - return null to let caller handle 404
		return null;
	}
}
