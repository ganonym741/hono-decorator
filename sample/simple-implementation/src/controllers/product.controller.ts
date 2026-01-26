import { Context } from "hono";
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Use,
  ToArguments,
  ToResponse,
  PipeInput,
  PipeOutput,
} from "@asla/hono-decorator";
import { AuthMiddleware, ProAndAdmin } from "../middleware/auth.middleware.js";
import {
  RateLimitDecorator,
  RateLimitGuard,
} from "../decorators/rate-limit.decorator.js";
import { dataStore } from "../store/data.store.js";
import type {
  Product,
  CreateProductDto,
  UpdateProductDto,
  PaginatedResponse,
} from "../types.js";

@Use(AuthMiddleware)
@RateLimitDecorator({
  active: true,
  user: {
    free: [50, 3600],
    pro: [200, 3600],
    enterprise: [1000, 3600],
  },
  ip: {
    global: [100, 3600],
  },
})
@Use(RateLimitGuard)
@Controller({ basePath: "/products" })
export class ProductController {
  @Get("/")
  async getAllProducts(ctx: Context) {
    const page = parseInt(ctx.req.query("page") || "1");
    const pageSize = parseInt(ctx.req.query("pageSize") || "10");
    const category = ctx.req.query("category");

    let products = dataStore.getAllProducts();

    if (category) {
      products = dataStore.getProductsByCategory(category);
    }

    const total = products.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedProducts = products.slice(startIndex, startIndex + pageSize);

    const response: PaginatedResponse<Product> = {
      data: paginatedProducts,
      total,
      page,
      pageSize,
      totalPages,
    };

    return ctx.json({ success: true, data: response });
  }

  @Get("/:id")
  async getProductById(ctx: Context) {
    const id = ctx.req.param("id");
    const product = dataStore.getProductById(id);

    if (!product) {
      return ctx.json(
        { success: false, error: "Product not found" },
        { status: 404 },
      );
    }

    return ctx.json({ success: true, data: product });
  }

  @Get("/category/:category")
  async getProductsByCategory(ctx: Context) {
    const category = ctx.req.param("category");
    const products = dataStore.getProductsByCategory(category);

    return ctx.json({ success: true, data: products, total: products.length });
  }

  @ToArguments(async function (ctx: Context) {
    const body = (await ctx.req.json()) as CreateProductDto;
    return [body] as const;
  })
  @ToResponse(function (product: Product, ctx: Context) {
    return ctx.json({ success: true, data: product }, { status: 201 });
  })
  @RateLimitDecorator({
    active: true,
    user: { free: [5, 3600], pro: [50, 3600], enterprise: [200, 3600] },
  })
  @Use(RateLimitGuard)
  @Use(ProAndAdmin)
  @Post("/")
  async createProduct(dto: CreateProductDto): Promise<Product> {
    return dataStore.createProduct(dto);
  }

  @PipeInput(async function (ctx: Context) {
    const id = ctx.req.param("id");
    const body = (await ctx.req.json()) as UpdateProductDto;
    return { id, body };
  })
  @ToResponse(function (product: Product | undefined, ctx: Context) {
    if (!product) {
      return ctx.json(
        { success: false, error: "Product not found" },
        { status: 404 },
      );
    }
    return ctx.json({ success: true, data: product });
  })
  @Use(ProAndAdmin)
  @Put("/:id")
  async updateProduct(input: { id: string; body: UpdateProductDto }) {
    return dataStore.updateProduct(input.id, input.body);
  }

  @Delete("/:id")
  async deleteProduct(ctx: Context) {
    const id = ctx.req.param("id");
    const deleted = dataStore.deleteProduct(id);

    if (!deleted) {
      return ctx.json(
        { success: false, error: "Product not found" },
        { status: 404 },
      );
    }

    return ctx.json({ success: true, message: "Product deleted successfully" });
  }

  @Get("/search/:query")
  async searchProducts(ctx: Context) {
    const query = ctx.req.param("query").toLowerCase();
    const products = dataStore
      .getAllProducts()
      .filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query),
      );

    return ctx.json({ success: true, data: products, total: products.length });
  }
}

@Controller({ extends: true, basePath: "/premium/products" })
export class PremiumProductController extends ProductController {
  @Get("/")
  async getPremiumProducts(ctx: Context) {
    const products = dataStore.getAllProducts().filter((p) => p.price > 50);

    return ctx.json({
      success: true,
      data: products,
      total: products.length,
      message: "Premium products only",
    });
  }

  @Get("/featured")
  async getFeaturedProducts(ctx: Context) {
    const products = dataStore.getAllProducts().slice(0, 3);

    return ctx.json({ success: true, data: products, total: products.length });
  }
}
