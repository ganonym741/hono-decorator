import { Context } from "hono";
import { Controller, Get } from "@asla/hono-decorator";
import { dataStore } from "../store/data.store.js";

@Controller({ basePath: "/health" })
export class HealthController {
  @Get("")
  healthCheck(ctx: Context) {
    return ctx.json({ 
      success: true, 
      message: "API is healthy",
      timestamp: new Date().toISOString()
    });
  }

  @Get("/stats")
  getStats(ctx: Context) {
    const stats = dataStore.getStats();
    
    return ctx.json({ 
      success: true, 
      data: stats,
      timestamp: new Date().toISOString()
    });
  }

  @Get("/info")
  getInfo(ctx: Context) {
    return ctx.json({ 
      success: true, 
      data: {
        name: "Hono Decorator Sample API",
        version: "1.0.0",
        description: "A sample API demonstrating @asla/hono-decorator features",
        features: [
          "ECMA Decorators",
          "Custom Decorators (Rate Limiting)",
          "Middleware (@Use)",
          "Transform Decorators (@ToArguments, @ToResponse)",
          "Pipe Decorators (@PipeInput, @PipeOutput)",
          "Inheritance",
          "Controller-level configuration",
          "Endpoint-level configuration"
        ]
      },
      timestamp: new Date().toISOString()
    });
  }
}
