import type { MiddlewareHandler } from "hono";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../types.js";

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = +(process.env.JWT_EXPIRES_IN || 24 * 86400);

export async function signJWT(
  payload: Omit<JwtPayload, "iat" | "exp">,
): Promise<string> {
  return new Promise((resolve, reject) => {
    jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
      (err, token) => {
        if (err) reject(err);
        else resolve(token!);
      },
    );
  });
}

export async function verifyJWT(token: string): Promise<JwtPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded as JwtPayload);
    });
  });
}

export const AuthMiddleware: MiddlewareHandler = async (ctx, next) => {
  const authHeader = ctx.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return ctx.json(
      { success: false, error: "Unauthorized: No token provided" },
      { status: 401 },
    );
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const decoded = await verifyJWT(token);
    ctx.set("user", decoded);
    return next();
  } catch (error) {
    console.error("JWT verification error:", error);
    return ctx.json(
      { success: false, error: "Unauthorized: Invalid or expired token" },
      { status: 401 },
    );
  }
};

export function RequireRole(
  ...allowedRoles: ("free" | "pro" | "admin")[]
): MiddlewareHandler {
  return async (ctx, next) => {
    const user = ctx.get("user");

    if (!user || !allowedRoles.includes(user.role)) {
      return ctx.json(
        { success: false, error: "Forbidden: Insufficient permissions" },
        { status: 403 },
      );
    }

    return next();
  };
}

export function RequireSubscription(
  ...allowedSubscriptions: ("free" | "pro" | "enterprise")[]
): MiddlewareHandler {
  return async (ctx, next) => {
    const user = ctx.get("user");

    if (!user || !allowedSubscriptions.includes(user.subscription)) {
      return ctx.json(
        {
          success: false,
          error: "Forbidden: Subscription level required",
          requiredSubscription: allowedSubscriptions,
        },
        { status: 403 },
      );
    }

    return next();
  };
}

export const AdminOnly = RequireRole("admin");

export const ProAndAdmin = RequireRole("pro", "admin");

export const ProAndEnterprise = RequireSubscription("pro", "enterprise");

export const EnterpriseOnly = RequireSubscription("enterprise");
