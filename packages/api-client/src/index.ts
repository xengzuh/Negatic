import { randomUUID } from 'node:crypto';
import createClient, { type Client } from 'openapi-fetch';
import type { paths, components } from './schema.js';

export interface NegaticClientOptions {
  /**
   * Root URL for the Negatic API, e.g. `https://api.negatic.dev/v1` in
   * production. Should NOT include a trailing slash.
   */
  baseUrl: string;
  /**
   * Bearer token. Either a Supabase JWT (dashboard users) or a scoped API
   * key (agents).
   */
  token: string;
}

/**
 * Create a typed client against the Negatic API.
 *
 * Every path, parameter, body, and response is type-checked against the
 * OpenAPI contract in `api-spec/openapi.yaml`. Misuse is a type error at
 * the call site.
 *
 * @example
 * const client = createNegaticClient({ baseUrl, token });
 * const { data, error } = await client.GET('/products', {
 *   params: { query: { limit: 10 } },
 * });
 */
export function createNegaticClient(
  opts: NegaticClientOptions,
): Client<paths> {
  return createClient<paths>({
    baseUrl: opts.baseUrl,
    headers: {
      Authorization: `Bearer ${opts.token}`,
    },
  });
}

/**
 * Generate a fresh idempotency key. Use one per logical write; replays of
 * the same request with the same key return the original response.
 */
export function newIdempotencyKey(): string {
  return randomUUID();
}

// Re-export the most-used schema types for convenience.
export type Product = components['schemas']['Product'];
export type ProductCreate = components['schemas']['ProductCreate'];
export type Order = components['schemas']['Order'];
export type OrderCreate = components['schemas']['OrderCreate'];
export type OrderItem = components['schemas']['OrderItem'];
export type OrderStatus = components['schemas']['OrderStatus'];
export type Unit = components['schemas']['Unit'];
export type Problem = components['schemas']['Problem'];

// Full surface for callers who want it.
export type { paths, components, operations } from './schema.js';
