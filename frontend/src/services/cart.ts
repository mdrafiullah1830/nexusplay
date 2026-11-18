// ============================================================
// NEXUSPLAY — Cart (localStorage-backed)
// ============================================================
import type { Product } from "../types";

export interface CartLine {
  id: string;
  name: string;
  brand: string;
  price: number;
  oldPrice: number;
  qty: number;
  colour?: string;
  category: string;
}

const KEY = "nexusplay_cart";
const EVENT = "nexusplay:cart";

export const DELIVERY_FEE = 120;
export const FREE_DELIVERY_THRESHOLD = 5000;

function read(): CartLine[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as CartLine[];
  } catch {
    return [];
  }
}

function write(lines: CartLine[]): void {
  localStorage.setItem(KEY, JSON.stringify(lines));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export const cart = {
  all: (): CartLine[] => read(),

  count: (): number => read().reduce((n, l) => n + l.qty, 0),

  subtotal: (): number => read().reduce((n, l) => n + l.qty * l.price, 0),

  deliveryFee: (subtotal?: number): number => {
    const sum = subtotal ?? cart.subtotal();
    if (sum === 0) return 0;
    return sum >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  },

  total: (): number => cart.subtotal() + cart.deliveryFee(),

  add: (product: Product, qty = 1, colour?: string): void => {
    const lines = read();
    const existing = lines.find((l) => l.id === product.id && l.colour === colour);
    if (existing) {
      existing.qty = Math.min(50, existing.qty + qty);
    } else {
      lines.push({
        id: product.id,
        name: product.name,
        brand: product.brand,
        price: product.price,
        oldPrice: product.oldPrice,
        qty,
        colour,
        category: product.category,
      });
    }
    write(lines);
  },

  setQty: (id: string, colour: string | undefined, qty: number): void => {
    let lines = read();
    if (qty <= 0) {
      lines = lines.filter((l) => !(l.id === id && l.colour === colour));
    } else {
      const line = lines.find((l) => l.id === id && l.colour === colour);
      if (line) line.qty = Math.min(50, qty);
    }
    write(lines);
  },

  remove: (id: string, colour?: string): void => {
    write(read().filter((l) => !(l.id === id && l.colour === colour)));
  },

  clear: (): void => write([]),

  onChange: (cb: () => void): void => window.addEventListener(EVENT, cb),
};

export function formatBDT(amount: number): string {
  return `BDT ${new Intl.NumberFormat("en-US").format(Math.round(amount))}`;
}
