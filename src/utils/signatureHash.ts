import crypto from "crypto";
import { config } from "../config";
import { validationError } from "./errors";

/**
 * Reusable payload signature hash utility.
 *
 * Alur:
 * 1. Client mengirim `x-signature` header berisi HMAC-SHA256
 *    dari JSON.stringify(sortedPayload) menggunakan shared secret.
 * 2. Server melakukan hash yang sama dan membandingkan.
 *
 * Ini mencegah payload tampering di transit.
 */

const SIGNATURE_HEADER = "x-signature";

/**
 * Membuat canonical string dari payload:
 * - Sort keys secara rekursif
 * - JSON.stringify hasilnya
 */
const canonicalize = (obj: unknown): string => {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalize).join(",") + "]";
  }

  const sorted = Object.keys(obj as Record<string, unknown>)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = (obj as Record<string, unknown>)[key];
        return acc;
      },
      {} as Record<string, unknown>,
    );

  const entries = Object.entries(sorted).map(
    ([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`,
  );
  return "{" + entries.join(",") + "}";
};

/**
 * Generate HMAC-SHA256 hash dari payload.
 */
export const generateSignatureHash = (payload: unknown): string => {
  const canonical = canonicalize(payload);
  return crypto
    .createHmac("sha256", config.internalApiSecret)
    .update(canonical)
    .digest("hex");
};

/**
 * Verifikasi signature dari request headers terhadap payload.
 * Throw validationError jika tidak cocok.
 */
export const verifyPayloadSignature = (
  headers: Record<string, string | string[] | undefined>,
  payload: unknown,
): void => {
  const signature = headers[SIGNATURE_HEADER];

  if (!signature || typeof signature !== "string") {
    throw validationError("Signature header diperlukan untuk operasi ini");
  }

  const expectedHash = generateSignatureHash(payload);

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedHash, "hex"),
  );

  if (!isValid) {
    throw validationError("Signature payload tidak valid");
  }
};
