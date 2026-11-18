// ============================================================
// NEXUSPLAY — Shared Types
// ============================================================

export type StockStatus = "in-stock" | "pre-order" | "out-of-stock";

export type CategorySlug = "controllers" | "keyboards" | "mice" | "other";

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: CategorySlug;
  price: number;
  oldPrice: number;
  image?: string;
  colours?: string[];
  compatibility: string[];
  connectivity?: string;
  cooling?: string;
  charging?: string;
  controller?: string;
  dock?: string;
  stock: StockStatus;
  advance?: number;
  description?: string;
  rating: number;
  createdAt?: string;
  imageUrls?: string[];
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TrackingEvent {
  status: string;
  note?: string;
  at: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  qty: number;
  colour?: string;
}

export interface Order {
  id: string;
  orderNo: string;
  userId?: string;
  customer: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    city?: string;
    area?: string;
    note?: string;
  };
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: "cod" | "bkash";
  bkashTrxId?: string;
  status: string;
  tracking: TrackingEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminStats {
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  awaitingVerification: number;
  delivered: number;
  revenue: number;
}
