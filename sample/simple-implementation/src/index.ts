import "dotenv/config";
import { Hono } from "hono";
import { applyController } from "@asla/hono-decorator";
import {
  CORSMiddleware,
  ErrorMiddleware,
  LoggingMiddleware,
} from "./middleware/logging.middleware.js";
import { HealthController } from "./controllers/health.controller.js";
import { AuthController } from "./controllers/auth.controller.js";
import {
  UserController,
  ExtendedUserController,
} from "./controllers/user.controller.js";
import {
  ProductController,
  PremiumProductController,
} from "./controllers/product.controller.js";

const app = new Hono();

// Apply global middleware
app.use("*", CORSMiddleware);
app.use("*", LoggingMiddleware);
app.use("*", ErrorMiddleware);

// Apply controllers
applyController(app, new AuthController());
applyController(app, new UserController());
applyController(app, new ExtendedUserController());
applyController(app, new ProductController());
applyController(app, new PremiumProductController());
applyController(app, new HealthController());

app.get("/", (c) => {
  return c.json({
    success: true,
    message: "Welcome to Hono Decorator Sample API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      auth: "/auth",
      users: "/users",
      products: "/products",
      premium: "/premium/products",
      api: "/api/v1",
    },
    documentation: {
      readme: "https://github.com/asnowc/hono-decorator",
      features: [
        "ECMA Decorators",
        "Custom Decorators (Rate Limiting)",
        "Middleware (@Use)",
        "Transform Decorators (@ToArguments, @ToResponse)",
        "Pipe Decorators (@PipeInput, @PipeOutput)",
        "Inheritance",
        "Controller-level configuration",
        "Endpoint-level configuration",
      ],
    },
  });
});

app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: "Endpoint not found",
    },
    404,
  );
});

const PORT = process.env.PORT || 3000;
console.log(`Application running on port ${PORT}`)

export default {
  fetch: app.fetch,
  port: PORT,
};
