/**
 * Helpers aligned with the official **`openai` npm package** file APIs.
 *
 * @see https://www.npmjs.com/package/openai — section **“File uploads”** (`toFile`, `File`, `client.files.create`)
 * @see https://platform.openai.com/docs/api-reference/files/create
 * @see https://platform.openai.com/docs/guides/text — file inputs in chat / completions (`file_data` vs `file_id`)
 *
 * This app usually sends **`file_data` (base64) inline** in chat messages so OpenAI-compatible gateways
 * (e.g. OpenRouter) work without an extra upload round-trip. Use {@link createUploadableFileFromBase64}
 * when you need a web **`File`** for `client.files.create()` (e.g. official `api.openai.com` + `file_id` in the message).
 */

import { toFile } from "openai";

/** Decode standard base64 (no data-URL prefix) into bytes. */
export function base64ToUint8Array(base64: string): Uint8Array {
  const bin = typeof atob !== "undefined" ? atob(base64) : "";
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Builds a `File` suitable for `client.files.create({ file, purpose: 'user_data' | 'vision' | ... })`
 * per the SDK’s `toFile` helper (npm docs).
 */
export async function createUploadableFileFromBase64(
  base64: string,
  filename: string,
  options?: { mimeType?: string; lastModified?: number },
): Promise<File> {
  const bytes = base64ToUint8Array(base64);
  return toFile(bytes, filename, {
    type: options?.mimeType,
    lastModified: options?.lastModified ?? Date.now(),
  });
}
