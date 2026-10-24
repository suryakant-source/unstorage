import { createError } from "./index.ts";

/**
 * Minimal structural shape of a Workers KV namespace, covering only what the
 * `cloudflare-kv-binding` driver calls. Both the global and the module form of
 * `@cloudflare/workers-types` satisfy it, with or without the DOM lib loaded,
 * where the web globals (`ReadableStream`, `Headers`, ...) resolve differently.
 */
export interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number; [option: string]: unknown },
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

/**
 * Minimal structural shape of a Workers R2 bucket, covering only what the
 * `cloudflare-r2-binding` driver calls. Both the global and the module form of
 * `@cloudflare/workers-types` satisfy it, with or without the DOM lib loaded.
 */
export interface R2BucketLike {
  head(key: string): Promise<{ uploaded: Date } | null>;
  get(key: string, options?: unknown): Promise<{ text(): Promise<string> } | null>;
  put(key: string, value: unknown, options?: unknown): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ objects: { key: string }[] }>;
}

type Binding = KVNamespaceLike | R2BucketLike;

let _env: Promise<Record<string, unknown> | undefined> | undefined;

/**
 * Lazily import `env` from the `cloudflare:workers` builtin module.
 *
 * Resolves to `undefined` outside of Cloudflare Workers.
 */
function importEnv(): Promise<Record<string, unknown> | undefined> {
  return (_env ??= import("cloudflare:workers").then(
    (m) => m.env as unknown as Record<string, unknown>,
    () => undefined,
  ));
}

export function getBinding<T extends Binding>(binding: T | string): T | Promise<T> {
  if (typeof binding !== "string") {
    return validateBinding(binding, "[binding]");
  }
  return importEnv().then((env) => validateBinding(env?.[binding] as T, binding));
}

function validateBinding<T extends Binding>(binding: T | undefined, bindingName: string): T {
  if (!binding) {
    throw createError("cloudflare", `Invalid binding \`${bindingName}\`: \`${binding}\``);
  }

  for (const key of ["get", "put", "delete"]) {
    if (!(key in binding)) {
      throw createError(
        "cloudflare",
        `Invalid binding \`${bindingName}\`: \`${key}\` key is missing`,
      );
    }
  }

  return binding;
}

export function getKVBinding(
  binding: KVNamespaceLike | string = "STORAGE",
): KVNamespaceLike | Promise<KVNamespaceLike> {
  return getBinding(binding);
}

export function getR2Binding(
  binding: R2BucketLike | string = "BUCKET",
): R2BucketLike | Promise<R2BucketLike> {
  return getBinding(binding);
}
