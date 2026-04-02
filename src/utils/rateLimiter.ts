/**
 * Custom in-memory rate limiter using sliding window counter.
 * No external dependencies required.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Name identifier for this limiter (used in logs & headers) */
  name?: string;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly name: string;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
    this.name = options.name || "default";

    // Cleanup expired entries every minute to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);

    // Allow garbage collection of the interval if the process exits
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Check if a key (e.g., IP address) is rate limited.
   * Returns remaining requests and reset time.
   */
  consume(key: string): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    total: number;
  } {
    const now = Date.now();
    const entry = this.store.get(key);

    // No entry or expired window → create new entry
    if (!entry || now >= entry.resetAt) {
      this.store.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });

      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt: now + this.windowMs,
        total: this.maxRequests,
      };
    }

    // Within window — increment counter
    entry.count++;

    if (entry.count > this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
        total: this.maxRequests,
      };
    }

    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetAt: entry.resetAt,
      total: this.maxRequests,
    };
  }

  /**
   * Remove expired entries to prevent memory leaks.
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[RateLimiter:${this.name}] Cleaned ${cleaned} expired entries`);
    }
  }

  /**
   * Get current store size (for monitoring).
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Destroy the limiter and clear the cleanup interval.
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}
