// User types
export interface User {
  id: string;
  email: string;
  name: string;
  subscription: "free" | "pro" | "enterprise";
  createdAt: Date;
}

export interface CreateUserDto {
  email: string;
  name: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface UpdateUserDto {
  name?: string;
  role?: "free" | "pro" | "admin";
}

// Product types
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductDto {
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
}

export interface UpdateProductDto {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  category?: string;
}

// Auth types
export interface JwtPayload {
  id: string;
  email: string;
  subscription: "free" | "pro" | "enterprise";
}

export interface AuthResponse {
  token: string;
  user: Omit<User, "password">;
}

export interface RateLimitConfig {
  active: boolean;
  user?: {
    free?: [number, number];  // [limit, windowSeconds]
    pro?: [number, number];
    enterprise?: [number, number];
  };
  ip?: {
    global?: [number, number];
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
