import { Request, Response, NextFunction } from "express";
import { RateLimiter } from "../utils/rateLimiter";
import { config } from "../config";

/**
 * Sensitive auth operations that get stricter rate limits
 * to prevent brute-force attacks.
 */
const AUTH_OPERATIONS = new Set([
  "login",
  "register",
  "forgotPassword",
  "resetPassword",
  "refreshToken",
]);

/**
 * Extract the GraphQL operation name from the request body.
 * Handles both explicit operationName and inline query parsing.
 */
const extractOperationName = (body: Record<string, unknown>): string | null => {
  // 1. Check explicit operationName field
  if (body.operationName && typeof body.operationName === "string") {
    return body.operationName;
  }

  // 2. Try to extract from query string (e.g., "mutation Login { login(...) }")
  const query = body.query as string | undefined;
  if (!query) return null;

  // Match: mutation/query OperationName { actualResolver(
  // Or directly: { actualResolver(
  const operationMatch = query.match(
    /(?:mutation|query)\s*(?:\w+\s*)?\{\s*(\w+)/
  );
  if (operationMatch) {
    return operationMatch[1];
  }

  return null;
};

/**
 * Get the client's real IP address, considering proxies.
 */
const getClientIp = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
};

// ─── Rate Limiter Instances ────────────────────────────────────

/** General API rate limiter: 100 requests per minute per IP */
const generalLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  name: "general",
});

/** Auth rate limiter: 10 requests per 15 minutes per IP (anti brute-force) */
const authLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 15 * 60 * 1000, // 15 minutes
  name: "auth",
});

// ─── Middleware ─────────────────────────────────────────────────

/**
 * Rate limiter middleware for Express.
 * Applies stricter limits to auth-sensitive operations.
 * Sets standard rate limit headers in the response.
 */
export const rateLimiterMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const clientIp = getClientIp(req);

  // Determine which limiter to use based on the GraphQL operation
  let limiter = generalLimiter;
  let isAuthOp = false;

  if (req.method === "POST" && req.body) {
    const operation = extractOperationName(req.body);
    if (operation && AUTH_OPERATIONS.has(operation)) {
      limiter = authLimiter;
      isAuthOp = true;
    }
  }

  const result = limiter.consume(clientIp);

  // Set standard rate limit headers
  res.setHeader("X-RateLimit-Limit", result.total);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, result.remaining));
  res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000));

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    res.setHeader("Retry-After", retryAfter);

    if (config.nodeEnv === "development") {
      console.warn(
        `[RateLimit] ${isAuthOp ? "AUTH" : "GENERAL"} limit exceeded for ${clientIp}`
      );
    }

    res.status(429).json({
      errors: [
        {
          message: isAuthOp
            ? "Too many authentication attempts. Please try again later."
            : "Too many requests. Please slow down.",
          extensions: {
            code: "RATE_LIMITED",
            statusCode: 429,
            retryAfter,
          },
        },
      ],
    });
    return;
  }

  next();
};
