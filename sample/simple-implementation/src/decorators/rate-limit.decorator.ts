import { createMetadataDecoratorFactory, getEndpointContext } from "@asla/hono-decorator";
import type { Context, MiddlewareHandler } from "hono";
import type { RateLimitConfig } from "../types.js";

// In-memory store for rate limiting (in production, use Redis or similar)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Create the rate limit metadata decorator
export const RateLimitDecorator = createMetadataDecoratorFactory<
  RateLimitConfig,
  [RateLimitConfig]
>((args, decoratorContext) => {
  if (decoratorContext.metadata) {
    // Merge with existing metadata if needed
    return { ...decoratorContext.metadata, ...args[0] };
  }
  return args[0];
});

export function getUserSubscription(ctx: Context): "free" | "pro" | "enterprise" | null {
  const user = ctx.get("user");
  return user?.subscription || null;
}

export function getUserId(ctx: Context): string | null {
  const user = ctx.get("user");
  return user?.id || null;
}

export function getClientIP(ctx: Context): string {
  return ctx.req.header("x-forwarded-for")?.split(",")[0]?.trim() 
    || ctx.req.header("cf-connecting-ip") 
    || ctx.req.header("x-real-ip") 
    || "unknown";
}

function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  
  let entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetTime) {
    // Create new entry or reset expired entry
    entry = { count: 0, resetTime: now + windowMs };
    rateLimitStore.set(key, entry);
  }
  
  entry.count++;
  const remaining = Math.max(0, limit - entry.count);
  
  return {
    allowed: entry.count <= limit,
    remaining,
    resetTime: entry.resetTime
  };
}

export const RateLimitGuard: MiddlewareHandler = async (ctx, next) => {
  const endpointContext = getEndpointContext(ctx);
  const controllerConfig = endpointContext.getControllerMetadata<RateLimitConfig>(RateLimitDecorator);
  const endpointConfig = endpointContext.getEndpointMetadata<RateLimitConfig>(RateLimitDecorator);
  
  // Merge configs
  const config: RateLimitConfig = {
    active: false,
    ...controllerConfig,
    ...endpointConfig
  };
  
  // If rate limiting is disabled, skip
  if (config?.active === false) {
    return next();
  }
  
  let key: string | null = null;
  let limit: number | null = null;
  let windowSeconds: number | null = null;
  
  // Try subscription-based rate limiting first (preferred)
  if (config.user) {
    const userId = getUserId(ctx);
    const userSubscription = getUserSubscription(ctx);
    
    if (userId && userSubscription) {
      if (userSubscription === "enterprise" && config.user.enterprise ) {
        key = `user:${userId}:enterprise`;
        [limit, windowSeconds] = config.user.enterprise;
      } else if (userSubscription === "pro" && config.user.pro) {
        key = `user:${userId}:pro`;
        [limit, windowSeconds] = config.user.pro;
      } else if (config.user.free) {
        key = `user:${userId}:free`;
        [limit, windowSeconds] = config.user.free;
      } 
    }
  }
  
  // Fallback to IP-based rate limiting
  if (!key && config.ip?.global) {
    const ip = getClientIP(ctx);
    key = `ip:${ip}`;
    [limit, windowSeconds] = config.ip.global;
  }
  
  // If no rate limit configuration found, skip
  if (!key || !limit || !windowSeconds) {
    return next();
  }
  
  // Check rate limit
  const result = checkRateLimit(key, limit, windowSeconds);
  
  // Set rate limit headers
  ctx.header("X-RateLimit-Limit", limit.toString());
  ctx.header("X-RateLimit-Remaining", result.remaining.toString());
  ctx.header("X-RateLimit-Reset", Math.ceil(result.resetTime / 1000).toString());
  
  if (!result.allowed) {
    return ctx.json(
      { 
        success: false,
        error: "Rate limit exceeded",
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
      },
      { status: 429 }
    );
  }
  
  return next();
};
