import type {
  User,
  Product,
  CreateUserDto,
  CreateProductDto,
  UpdateUserDto,
  UpdateProductDto,
} from "../types.js";

// Mock data store
class DataStore {
  private users: Map<string, User> = new Map();
  private products: Map<string, Product> = new Map();
  private userIdCounter = 1;
  private productIdCounter = 1;

  constructor() {
    this.initializeData();
  }

  private initializeData() {
    const users: User[] = [
      {
        id: "1",
        email: "admin@example.com",
        name: "Admin User",
        subscription: "enterprise",
        createdAt: new Date(),
      },
      {
        id: "2",
        email: "pro@example.com",
        name: "Pro User",
        subscription: "pro",
        createdAt: new Date(),
      },
      {
        id: "3",
        email: "free@example.com",
        name: "Free User",
        subscription: "free",
        createdAt: new Date(),
      },
    ];

    users.forEach((user) => this.users.set(user.id, user));

    const products: Product[] = [
      {
        id: "1",
        name: "Premium Widget",
        description: "A high-quality widget for pro users",
        price: 99.99,
        stock: 100,
        category: "widgets",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "2",
        name: "Basic Gadget",
        description: "A simple gadget for everyone",
        price: 19.99,
        stock: 500,
        category: "gadgets",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "3",
        name: "Super Tool",
        description: "An advanced tool for power users",
        price: 149.99,
        stock: 50,
        category: "tools",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    products.forEach((product) => this.products.set(product.id, product));
  }

  // User operations
  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  getUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  getUserByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find((u) => u.email === email);
  }

  createUser(dto: CreateUserDto): User {
    const id = (this.userIdCounter++).toString();
    const user: User = {
      id,
      email: dto.email,
      name: dto.name,
      subscription: "free",
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  updateUser(id: string, dto: UpdateUserDto): User | undefined {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updated: User = {
      ...user,
      ...dto,
    };
    this.users.set(id, updated);
    return updated;
  }

  deleteUser(id: string): boolean {
    return this.users.delete(id);
  }

  // Product operations
  getAllProducts(): Product[] {
    return Array.from(this.products.values());
  }

  getProductById(id: string): Product | undefined {
    return this.products.get(id);
  }

  getProductsByCategory(category: string): Product[] {
    return Array.from(this.products.values()).filter(
      (p) => p.category === category,
    );
  }

  createProduct(dto: CreateProductDto): Product {
    const id = (this.productIdCounter++).toString();
    const now = new Date();
    const product: Product = {
      id,
      name: dto.name,
      description: dto.description,
      price: dto.price,
      stock: dto.stock,
      category: dto.category,
      createdAt: now,
      updatedAt: now,
    };
    this.products.set(id, product);
    return product;
  }

  updateProduct(id: string, dto: UpdateProductDto): Product | undefined {
    const product = this.products.get(id);
    if (!product) return undefined;

    const updated: Product = {
      ...product,
      ...dto,
      updatedAt: new Date(),
    };
    this.products.set(id, updated);
    return updated;
  }

  deleteProduct(id: string): boolean {
    return this.products.delete(id);
  }

  getStats() {
    return {
      totalUsers: this.users.size,
      totalProducts: this.products.size,
      usersBySubscription: {
        enterprise: Array.from(this.users.values()).filter(
          (u) => u.subscription === "enterprise",
        ).length,
        pro: Array.from(this.users.values()).filter(
          (u) => u.subscription === "pro",
        ).length,
        free: Array.from(this.users.values()).filter(
          (u) => u.subscription === "free",
        ).length,
      },
      productsByCategory: Array.from(this.products.values()).reduce(
        (acc, p) => {
          acc[p.category] = (acc[p.category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}

export const dataStore = new DataStore();
