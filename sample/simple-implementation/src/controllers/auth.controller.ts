import { Context } from "hono";
import {
  Controller,
  Post,
  Use,
  ToArguments,
  ToResponse,
} from "@asla/hono-decorator";
import { signJWT } from "../middleware/auth.middleware.js";
import {
  RateLimitDecorator,
  RateLimitGuard,
} from "../decorators/rate-limit.decorator.js";
import { dataStore } from "../store/data.store.js";
import type { LoginDto, AuthResponse } from "../types.js";

@Controller({ basePath: "/auth" })
export class AuthController {
  @ToArguments(async function (ctx: Context) {
    const body = (await ctx.req.json()) as LoginDto;
    return [body.email, body.password] as const;
  })
  @ToResponse(function (data: AuthResponse, ctx: Context) {
    return ctx.json({ success: true, data });
  })
  @RateLimitDecorator({
    active: true,
    user: { free: [5, 300], pro: [20, 300], enterprise: [100, 300] }, // Stricter for login
    ip: { global: [5, 300] },
  })
  @Use(RateLimitGuard)
  @Post("/login")
  async login(email: string, password: string): Promise<AuthResponse> {
    const user = dataStore.getUserByEmail(email);

    if (!user) {
      throw new Error("Invalid credentials");
    }

    if (!password) {
      throw new Error("Invalid credentials");
    }

    const token = await signJWT({
      id: user.id,
      email: user.email,
      subscription: user.subscription,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscription: user.subscription,
        createdAt: user.createdAt,
      },
    };
  }
}
