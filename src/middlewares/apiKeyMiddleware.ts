import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { config } from "../config";

/**
 * Constant-time string comparison to prevent timing attacks.
 * Returns true if both strings are equal.
 */
const safeCompare = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    // Still do a comparison to keep timing consistent,
    // but we already know the result is false.
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

/**
 * Middleware to validate internal API secret on every request.
 * Expects the secret in the `x-api-key` header.
 * Skips validation if INTERNAL_API_SECRET is not configured (dev convenience).
 */
export const apiKeyMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Skip if no secret is configured (optional in dev)
  if (!config.internalApiSecret) {
    next();
    return;
  }

  const apiKey = req.headers["x-api-key"] as string | undefined;

  if (!apiKey) {
    res.status(401).json({
      errors: [
        {
          message: "Missing API key.",
          extensions: { code: "UNAUTHENTICATED", statusCode: 401 },
        },
      ],
    });
    return;
  }

  if (!safeCompare(apiKey, config.internalApiSecret)) {
    res.status(403).json({
      errors: [
        {
          message: "Invalid API key.",
          extensions: { code: "FORBIDDEN", statusCode: 403 },
        },
      ],
    });
    return;
  }

  next();
};
