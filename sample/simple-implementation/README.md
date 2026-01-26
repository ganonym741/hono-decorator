# Hono Decorator Sample API

A comprehensive sample API demonstrating all features of `@asla/hono-decorator` library, including custom decorators, middleware, transformations, and inheritance.

> **⚠️ Important Notice**: This is a **reference implementation** for learning and prototyping. It requires significant enhancements before production deployment. See [Production Considerations](#production-considerations) for details.

## Features Demonstrated

- ✅ **ECMA Decorators** - Modern TypeScript decorator syntax (Stage 3 proposal)
- ✅ **Custom Decorators** - Rate limiting by user subscription/IP
- ✅ **Real JWT Authentication** - Using `jsonwebtoken` library
- ✅ **Middleware** - `@Use` decorator for middleware application
- ✅ **Transform Decorators** - `@ToArguments`, `@ToResponse`
- ✅ **Pipe Decorators** - `@PipeInput`, `@PipeOutput`
- ✅ **Inheritance** - Controller inheritance with configuration override
- ✅ **Controller-level Configuration** - Base path, rate limits
- ✅ **Endpoint-level Configuration** - Per-endpoint rate limits
- ✅ **Subscription Authorization** - `@RequireSubscription` middleware
- ✅ **Comprehensive Testing** - Unit tests with Vitest

## Prerequisites

- Bun 1.0+
- TypeScript 5.2+ (for ECMA decorator support)

## Installation

```bash
cd sample/simple-implementation

# Using npm
npm install

# Using pnpm
pnpm install

# Using bun
bun install
```

## Running the Server

```bash
# Development mode with hot reload (tsx watch)
npm run dev
# or
pnpm run dev
# or
bun run dev

# Production mode
npm run build && npm run start
# or
bun run build && bun run start
```

The server will start on `http://localhost:3000`

## TypeScript Configuration

This project uses **ECMA decorators** (Stage 3 proposal) instead of legacy TypeScript decorators:

```json
{
  "compilerOptions": {
    "experimentalDecorators": false,
    "target": "ES2023",
    "module": "NodeNext",
    "strict": true
  }
}
```

This requires TypeScript 5.2+ and enables modern decorator syntax used throughout the project.

## API Endpoints

### Health Check

| Method | Endpoint | Description | Auth |
|---------|-----------|-------------|-------|
| GET | `/health` | Basic health check | No |
| GET | `/health/stats` | API statistics | No |
| GET | `/health/info` | API information | No |

### Authentication

| Method | Endpoint | Description | Auth |
|---------|-----------|-------------|-------|
| POST | `/auth/login` | Login and get JWT token | No |

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "any-password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "1",
      "email": "admin@example.com",
      "name": "Admin User",
      "subscription": "enterprise"
    }
  }
}
```

### Users

| Method | Endpoint | Description | Auth | Subscription |
|---------|-----------|-------------|-------|-----------------|
| GET | `/users` | Get all users | Yes | Admin |
| GET | `/users/me` | Get current user profile | Yes | Any |
| GET | `/users/:id` | Get user by ID | Yes | Admin |
| POST | `/users` | Create new user | Yes | Admin |
| PUT | `/users/:id` | Update user | Yes | Admin |
| DELETE | `/users/:id` | Delete user | Yes | Admin |
| PATCH | `/users/:id/upgrade` | Upgrade user to Pro | Yes | Admin |

**Example Request (Create User):**
```bash
curl -X POST http://localhost:3000/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "new@example.com",
    "name": "New User",
    "password": "password123"
  }'
```

### Extended Users (API v1)

| Method | Endpoint | Description | Auth | Rate Limit |
|---------|-----------|-------------|-------|-------------|
| GET | `/api/v1/users` | Get all users (with rate limiting) | Yes | Free: 30/h, Pro: 100/h, Enterprise: 1000/h |
| GET | `/api/v1/users/subscription/:subscription` | Filter users by subscription | Yes | Inherits from controller |

### Products

| Method | Endpoint | Description | Auth | subscription |
|---------|-----------|-------------|-------|-------|
| GET | `/products` | Get all products (with pagination) | Yes | Any |
| GET | `/products/:id` | Get product by ID | Yes | Any |
| GET | `/products/category/:category` | Get products by category | Yes | Any |
| GET | `/products/search/:query` | Search products | Yes | Any |
| POST | `/products` | Create new product | Yes | Pro/Admin |
| PUT | `/products/:id` | Update product | Yes | Pro/Admin |
| DELETE | `/products/:id` | Delete product | Yes | Admin |

**Example Request (Get Products with Pagination):**
```bash
curl "http://localhost:3000/products?page=1&pageSize=10&category=widgets"
```

### Premium Products

| Method | Endpoint | Description | Auth |
|---------|-----------|-------------|-------|
| GET | `/premium/products` | Get premium products only | Yes |
| GET | `/premium/products/featured` | Get featured products | Yes |

## Rate Limiting

The API implements a custom `@RateLimitDecorator` that limits requests based on:

### Priority System

The rate limiting system follows this priority order:

1. **Subscription-based** (highest priority) - Uses user subscription from JWT
2. **IP-based** (fallback) - Uses client IP address when no user is authenticated

### Subscription-based Rate Limits

| Subscription | Requests | Window |
|-----------|----------|--------|
| Free | 10-50/hour | 3600s |
| Pro | 100-200/hour | 3600s |
| Enterprise | 1000/hour | 3600s |

### Endpoint-Specific Rate Limits

**Login Endpoint** (stricter limits):
- Free: 5 requests / 5 minutes
- Pro: 20 requests / 5 minutes
- Enterprise: 100 requests / 5 minutes
- IP: 5 requests / 5 minutes (fallback)

**General Endpoints**:
- Free: 10-50 requests / hour
- Pro: 100-200 requests / hour
- Enterprise: 1000 requests / hour
- IP: 20-100 requests / hour (fallback)

### Rate Limit Headers

All rate-limited endpoints return these headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706150400
```

### Rate Limit Response

When rate limit is exceeded:

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 300
}
```

### How Subscription Type is Obtained

The subscription type is extracted from the decoded JWT token:

1. **User Login**: When a user logs in, the JWT token includes their subscription type
2. **Token Verification**: The `AuthMiddleware` verifies the JWT and attaches the decoded payload to the context
3. **Rate Limiting**: The `RateLimitGuard` middleware reads the subscription type from `ctx.get("user").subscription`
4. **Priority**: Subscription-based limits take priority over role-based limits

```typescript
// In auth.middleware.ts - JWT payload includes subscription
const decoded = await verifyJWT(token);  // Returns JwtPayload with subscription
ctx.set("user", decoded);  // Stores user with subscription in context

// In rate-limit.decorator.ts - Read subscription from context
const userSubscription = getUserSubscription(ctx);  // Gets subscription from ctx.get("user")
if (config.user.enterprise && userSubscription === "enterprise") {
  // Apply enterprise rate limits
}
```

## Test Users

The API comes with pre-configured test users:

| Email | Subscription | Password |
|-------|------|-------------|----------|
| admin@example.com | enterprise | any |
| pro@example.com | pro | any |
| free@example.com | free | any |

> **⚠️ Security Warning**: In this sample implementation, any password is accepted. This is for demonstration purposes only. Always implement proper password hashing in production.

## Code Examples

### 1. Basic Controller with Endpoints

```typescript
import { Controller, Get, Post } from "@asla/hono-decorator";
import { Context } from "hono";

@Controller({ basePath: "/api" })
class MyController {
  @Get("/hello")
  hello(ctx: Context) {
    return ctx.json({ message: "Hello World" });
  }

  @Post("/echo")
  async echo(ctx: Context) {
    const body = await ctx.req.json();
    return ctx.json(body);
  }
}
```

### 2. Real JWT Authentication

```typescript
import { signJWT, verifyJWT, AuthMiddleware } from "./middleware/auth.middleware";

// Sign JWT token (includes subscription type)
const token = await signJWT({
  id: user.id,
  email: user.email,
  subscription: user.subscription
});

// Verify JWT token
const decoded = await verifyJWT(token);
// decoded = { id, email, subscription }

// Apply authentication middleware
@Use(AuthMiddleware)
class ProtectedController {
  @Get("/profile")
  getProfile(ctx: Context) {
    const user = ctx.get("user");  // Decoded JWT payload
    return ctx.json({ user });
  }
}
```

### 3. Using @ToArguments Decorator

```typescript
import { ToArguments } from "@asla/hono-decorator";

@ToArguments(async (ctx: Context) => {
  const body = await ctx.req.json();
  return [body.email, body.password] as const;
})
@Post("/login")
async login(email: string, password: string) {
  // email and password are already extracted
  return { email, password };
}
```

### 4. Using @ToResponse Decorator

```typescript
import { ToResponse } from "@asla/hono-decorator";

@ToResponse((data, ctx: Context) => {
  return ctx.json({ success: true, data });
})
@Get("/users")
async getUsers() {
  return [{ id: 1, name: "John" }];
}
```

### 5. Using @PipeInput and @PipeOutput

```typescript
import { PipeInput, PipeOutput } from "@asla/hono-decorator";

@PipeInput(
  async (ctx: Context) => {
    const body = await ctx.req.json();
    return { id: ctx.req.param("id"), body };
  }
)
@PipeOutput(
  (result) => dataStore.updateProduct(result.id, result.body),
  (product, ctx) => ctx.json({ success: true, data: product })
)
@Put("/products/:id")
async updateProduct(input: { id: string; body: UpdateProductDto }) {
  return input;
}
```

### 6. Custom Rate Limit Decorator

```typescript
import { RateLimitDecorator, RateLimitGuard } from "./decorators/rate-limit.decorator";

// Subscription-based rate limiting (priority)
@RateLimitDecorator({
  active: true,
  user: {
    free: [10, 3600],      // 10 per hour for free
    pro: [100, 3600],       // 100 per hour for pro
    enterprise: [1000, 3600]  // 1000 per hour for enterprise
  }
})
@Use(RateLimitGuard)
@Controller({ basePath: "/api" })
class ApiController {
  @Get("/data")
  getData() {
    return { message: "Rate limited by subscription" };
  }
}
```

### 7. Controller Inheritance

```typescript
// Base controller
@Use(AuthMiddleware)
@Controller({ basePath: "/users" })
class UserController {
  @Get("/")
  getAllUsers() {
    return dataStore.getAllUsers();
  }
}

// Extended controller with rate limiting
@RateLimitDecorator({ active: true, user: { free: [30, 3600] } })
@Use(RateLimitGuard)
@Controller({ extends: true, basePath: "/api/v1" })
class ExtendedUserController extends UserController {
  @Get("/")
  async getAllUsers() {
    return super.getAllUsers();
  }

  @Get("/subscription/:subscription")
  getUsersBySubscription(ctx: Context) {
    const subscription = ctx.req.param("subscription");
    return dataStore.getAllUsers().filter(u => u.subscription === subscription);
  }
}
```

### 8. Subscription-based Authorization

```typescript
import { RequireSubscription } from "./middleware/auth.middleware";

// Only allow pro and enterprise subscriptions
@RequireSubscription("pro", "enterprise")
@Controller({ basePath: "/premium" })
class PremiumController {
  @Get("/features")
  getPremiumFeatures() {
    return { features: ["advanced-analytics", "priority-support"] };
  }
}

// Only allow enterprise subscription
@RequireSubscription("enterprise")
@Controller({ basePath: "/enterprise" })
class EnterpriseController {
  @Get("/api-keys")
  getApiKeys() {
    return { keys: ["key-1", "key-2"] };
  }
}
```

## Project Structure

```
sample/simple-implementation/
├── src/
│   ├── controllers/
│   │   ├── auth.controller.ts           # Authentication endpoints
│   │   ├── user.controller.ts           # User management
│   │   ├── product.controller.ts         # Product management
│   │   └── health.controller.ts         # Health check endpoints
│   ├── decorators/
│   │   └── rate-limit.decorator.ts    # Custom rate limiting decorator
│   ├── middleware/
│   │   ├── auth.middleware.ts          # Authentication & authorization
│   │   ├── logging.middleware.ts       # Logging & error handling
│   │   └── __tests__/               # Middleware tests
│   │       ├── auth.middleware.test.ts
│   │       └── logging.middleware.test.ts
│   ├── store/
│   │   └── data.store.ts              # In-memory data store
│   ├── types.ts                        # TypeScript types
│   └── index.ts                       # Main server entry point
├── .env                              # Environment variables (not in git)
├── .env.example                      # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts                  # Vitest configuration
├── vitest.setup.js                   # Test setup file
└── README.md
```
