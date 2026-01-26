import { Context } from "hono";
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Use,
  ToArguments,
  ToResponse,
  PipeOutput,
} from "@asla/hono-decorator";
import { AuthMiddleware, AdminOnly } from "../middleware/auth.middleware.js";
import {
  RateLimitDecorator,
  RateLimitGuard,
} from "../decorators/rate-limit.decorator.js";
import { dataStore } from "../store/data.store.js";
import type {
  User,
  CreateUserDto,
  UpdateUserDto,
} from "../types.js";

@Use(AuthMiddleware)
@Controller({ basePath: "/users" })
export class UserController {
  @PipeOutput(
    function (users: User[]) {
      return users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        subscription: u.subscription,
        createdAt: u.createdAt,
      }));
    },
    function (data, ctx: Context) {
      return ctx.json({ success: true, data, total: data.length });
    },
  )
  @Use(AdminOnly)
  @Get("/")
  async getAllUsers(): Promise<User[]> {
    return dataStore.getAllUsers();
  }

  @Get("/me")
  async getProfile(ctx: Context) {
    const userId = ctx.get("user")?.id;
    const user = dataStore.getUserById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    return ctx.json({ success: true, data: user });
  }

  @Get("/:id")
  async getUserById(ctx: Context) {
    const id = ctx.req.param("id");
    const user = dataStore.getUserById(id);

    if (!user) {
      return ctx.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    return ctx.json({ success: true, data: user });
  }

  @ToArguments(async function (ctx: Context) {
    const body = (await ctx.req.json()) as CreateUserDto;
    return [body] as const;
  })
  @ToResponse(function (user: User, ctx: Context) {
    return ctx.json({ success: true, data: user }, { status: 201 });
  })
  @Use(AdminOnly)
  @Post("")
  async createUser(dto: CreateUserDto): Promise<User> {
    if (dataStore.getUserByEmail(dto.email)) {
      throw new Error("User already exists");
    }

    return dataStore.createUser(dto);
  }

  @ToArguments(async function (ctx: Context) {
    const id = ctx.req.param("id");
    const body = (await ctx.req.json()) as UpdateUserDto;
    return [id, body] as const;
  })
  @ToResponse(function (user: User | undefined, ctx: Context) {
    if (!user) {
      return ctx.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }
    return ctx.json({ success: true, data: user });
  })
  @Use(AdminOnly)
  @Put("/:id")
  async updateUser(id: string, dto: UpdateUserDto): Promise<User | undefined> {
    return dataStore.updateUser(id, dto);
  }

  @Delete("/:id")
  async deleteUser(ctx: Context) {
    const id = ctx.req.param("id");
    const deleted = dataStore.deleteUser(id);

    if (!deleted) {
      return ctx.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    return ctx.json({ success: true, message: "User deleted successfully" });
  }

  @Use(AdminOnly)
  @Patch("/:id/upgrade")
  async upgradeUser(ctx: Context) {
    const id = ctx.req.param("id");
    const user = dataStore.updateUser(id, { role: "pro" });

    if (!user) {
      return ctx.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    return ctx.json({
      success: true,
      data: user,
      message: "User upgraded to Pro",
    });
  }
}

@RateLimitDecorator({
  active: true,
  user: {
    free: [30, 3600],
    pro: [100, 3600],
    enterprise: [1000, 3600],
  },
})
@Use(RateLimitGuard)
@Controller({ extends: true, basePath: "/api/v1" })
export class ExtendedUserController extends UserController {
  @RateLimitDecorator({
    active: true,
    user: { free: [10, 3600], pro: [50, 3600], enterprise: [500, 3600] },
  })
  @Use(RateLimitGuard)
  @Get("/")
  async getAllUsers(): Promise<User[]> {
    return super.getAllUsers();
  }

  @Get("/subscription/:subscription")
  async getUsersByRole(ctx: Context) {
    const subscription = ctx.req.param("subscription") as
      | "free"
      | "pro"
      | "enterprise";
    const users = dataStore
      .getAllUsers()
      .filter((u) => u.subscription === subscription);

    return ctx.json({ success: true, data: users, total: users.length });
  }
}
