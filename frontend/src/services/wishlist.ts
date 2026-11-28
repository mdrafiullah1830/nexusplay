import { api, ApiError } from "./api";
import { auth } from "./auth";
import type { Product } from "../types";

interface SavedProduct { productId: string; name: string; price: number; imageUrl?: string }
const key = "nexusplay_wishlist";
function readGuest(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === "string"))] : [];
  } catch { return []; }
}
function writeGuest(ids: string[]): void { localStorage.setItem(key, JSON.stringify(ids)); }
const signedIn = () => auth.isLoggedIn() && !auth.isExpired();
let accountItems: SavedProduct[] = [];
let accountReady: Promise<void> | undefined;
const changed = () => document.dispatchEvent(new CustomEvent("wishlist:change"));
async function reloadAccount(): Promise<void> {
  const result = await api.get<{ items: SavedProduct[] }>("/wishlist", true);
  accountItems = result.items;
}
async function initAccount(): Promise<void> {
  await reloadAccount();
  const guest = readGuest();
  const remaining: string[] = [];
  for (const id of guest) {
    try { await api.post("/wishlist", { productId: id }, true); }
    catch { remaining.push(id); }
  }
  if (guest.length) writeGuest(remaining);
  await reloadAccount();
  changed();
}
function ready(): Promise<void> {
  if (!accountReady) accountReady = initAccount().catch(error => { accountReady = undefined; throw error; });
  return accountReady;
}
let queue: Promise<void> = Promise.resolve();
export const wishlist = {
  has(id: string): boolean { return signedIn() ? accountItems.some(p => p.productId === id) : readGuest().includes(id); },
  count(): number { return signedIn() ? accountItems.length : readGuest().length; },
  async products(): Promise<SavedProduct[]> {
    if (signedIn()) { await ready(); return accountItems; }
    const products = await Promise.all(readGuest().map(async id => {
      try {
        const p = await api.get<Product>("/products/" + encodeURIComponent(id));
        return { productId: p.id, name: p.name, price: p.price, imageUrl: p.imageUrls?.[0] ?? p.image };
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    }));
    return products.filter((p): p is NonNullable<typeof p> => p !== null);
  },
  set(id: string, saved: boolean): Promise<void> {
    const task = queue.then(async () => {
      if (signedIn()) {
        await ready();
        if (saved) await api.post("/wishlist", { productId: id }, true);
        else await api.del("/wishlist/" + encodeURIComponent(id), true);
        await reloadAccount();
      } else {
        const ids = readGuest().filter(x => x !== id);
        if (saved) ids.push(id);
        writeGuest(ids);
      }
      changed();
    });
    queue = task.catch(() => {});
    return task;
  },
  init(): void { if (signedIn()) void ready().catch(() => {}); },
};
