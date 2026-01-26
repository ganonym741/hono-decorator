import type { Context, MiddlewareHandler } from "hono";

// Request logging middleware
export const LoggingMiddleware: MiddlewareHandler = async (ctx, next) => {
  const start = Date.now();
  const method = ctx.req.method;
  const path = ctx.req.path;
  
  console.log(`[${new Date().toISOString()}] ${method} ${path} - Request started`);
  
  await next();
  
  const duration = Date.now() - start;
  const status = ctx.res.status;
  
  console.log(`[${new Date().toISOString()}] ${method} ${path} - ${status} (${duration}ms)`);
};

// Error handling middleware
export const ErrorMiddleware: MiddlewareHandler = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error("Error:", error);
    
    if (error instanceof Error) {
      return ctx.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    return ctx.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
};

// CORS middleware
export const CORSMiddleware: MiddlewareHandler = async (ctx, next) => {
  ctx.header("Access-Control-Allow-Origin", "*");
  ctx.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  ctx.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (ctx.req.method === "OPTIONS") {
    return ctx.newResponse(null, { status: 204 });
  }
  
  return next();
};
