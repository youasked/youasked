// plans.ts (shared with the API) only imports types from the Workers runtime. This stands in for them.
declare type D1Database = { prepare(q: string): { bind(...a: unknown[]): { first<T = unknown>(): Promise<T | null> } } };
declare type R2Bucket = any;
declare type Ai = any;
declare type VectorizeIndex = any;
declare type SendEmail = any;
