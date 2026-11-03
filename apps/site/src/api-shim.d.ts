// The pricing page imports plan data from the API's plans.ts, which imports type-only names for
// Cloudflare bindings. The browser build has no use for them, so stand in with minimal types.
interface D1Database {
  prepare(query: string): { bind(...values: unknown[]): { first<T = unknown>(): Promise<T | null> } };
}
declare type R2Bucket = unknown;
declare type Ai = unknown;
declare type VectorizeIndex = unknown;
declare type SendEmail = unknown;
