// ============================================================
// NEXUSPLAY — Chrome i18n (English / বাংলা)
// Scope: header, search, mini-cart and drawer labels.
// Page body copy stays English until it is translated.
// ============================================================

export type Lang = "en" | "bn";

const KEY = "nexusplay_lang";
const EVENT = "nexusplay:lang";

type Entry = { en: string; bn: string };

const DICT: Record<string, Entry> = {
  "skip": { en: "Skip to content", bn: "মূল কন্টেন্টে যান" },

  // Announcement bar
  "announce.shipping": {
    en: "Free delivery on orders over BDT 5,000",
    bn: "৳৫,০০০-এর বেশি অর্ডারে ফ্রি ডেলিভারি",
  },
  "announce.payment": {
    en: "bKash · Cards · Cash on delivery",
    bn: "bKash · কার্ড · ক্যাশ অন ডেলিভারি",
  },
  "announce.preorder": {
    en: "Pre-order: GameSir G7 Pro 8K Phantom Blade Zero",
    bn: "প্রি-অর্ডার: GameSir G7 Pro 8K Phantom Blade Zero",
  },
  "announce.hotline": {
    en: "Hotline & WhatsApp: +880 1782-577251",
    bn: "হটলাইন ও WhatsApp: +880 1782-577251",
  },
  "announce.trust": {
    en: "100% authentic gear · 30-day returns · Warranty support",
    bn: "১০০% অরিজিনাল গিয়ার · ৩০ দিনের রিটার্ন · ওয়ারেন্টি সাপোর্ট",
  },

  // Primary navigation
  "nav.home": { en: "Home", bn: "হোম" },
  "nav.shop": { en: "Shop", bn: "শপ" },
  "nav.track": { en: "Track Order", bn: "অর্ডার ট্র্যাক" },
  "nav.support": { en: "Support", bn: "সাপোর্ট" },
  "nav.sale": { en: "Sale", bn: "সেল" },
  "nav.search": { en: "Search", bn: "খুঁজুন" },
  "nav.wishlist": { en: "Wishlist", bn: "উইশলিস্ট" },
  "nav.account": { en: "Account", bn: "অ্যাকাউন্ট" },
  "nav.cart": { en: "Cart", bn: "কার্ট" },
  "nav.menu": { en: "Open menu", bn: "মেনু খুলুন" },
  "nav.close": { en: "Close", bn: "বন্ধ করুন" },
  "nav.language": { en: "Change language", bn: "ভাষা পরিবর্তন করুন" },

  // Mega menu
  "mega.shop": { en: "Shop", bn: "শপ" },
  "mega.brands": { en: "Brands", bn: "ব্র্যান্ড" },
  "mega.deals": { en: "Deals", bn: "ডিল" },
  "mega.controllers": { en: "Controllers", bn: "কন্ট্রোলার" },
  "mega.cooling": { en: "Cooling pads", bn: "কুলিং প্যাড" },
  "mega.docks": { en: "Docks & stands", bn: "ডক ও স্ট্যান্ড" },
  "mega.preorders": { en: "Pre-orders", bn: "প্রি-অর্ডার" },
  "mega.under3k": { en: "Under BDT 3,000", bn: "৳৩,০০০-এর নিচে" },
  "mega.under5k": { en: "Under BDT 5,000", bn: "৳৫,০০০-এর নিচে" },
  "mega.savings": { en: "Biggest savings", bn: "সবচেয়ে বেশি ছাড়" },
  "mega.all": { en: "View all products", bn: "সব প্রোডাক্ট দেখুন" },
  "mega.promo.title": { en: "Apex 6 Pro", bn: "Apex 6 Pro" },
  "mega.promo.text": {
    en: "Hall-effect sticks, 8K polling and pro-grade control.",
    bn: "হল-ইফেক্ট স্টিক, 8K পোলিং ও প্রো-গ্রেড কন্ট্রোল।",
  },
  "mega.promo.cta": { en: "Shop Flydigi", bn: "Flydigi দেখুন" },
  "mega.badge.new": { en: "New", bn: "নতুন" },

  // Search
  "search.placeholder": {
    en: "Search controllers, brands…",
    bn: "কন্ট্রোলার, ব্র্যান্ড খুঁজুন…",
  },
  "search.recent": { en: "Recent searches", bn: "সাম্প্রতিক সার্চ" },
  "search.popular": { en: "Popular", bn: "জনপ্রিয়" },
  "search.empty": { en: "No products found", bn: "কোনো প্রোডাক্ট পাওয়া যায়নি" },
  "search.searching": { en: "Searching…", bn: "খোঁজা হচ্ছে…" },
  "search.viewall": { en: "View all results", bn: "সব ফলাফল দেখুন" },
  "search.clear": { en: "Clear search", bn: "সার্চ মুছুন" },
  "search.label": { en: "Search products", bn: "প্রোডাক্ট খুঁজুন" },

  // Account dropdown
  "account.signedInAs": { en: "Signed in as", bn: "লগ ইন করা আছে" },
  "account.signin": { en: "Log in", bn: "লগ ইন" },
  "account.signup": { en: "Create account", bn: "অ্যাকাউন্ট খুলুন" },
  "account.wishlist": { en: "Wishlist", bn: "উইশলিস্ট" },
  "account.track": { en: "Track order", bn: "অর্ডার ট্র্যাক" },
  "account.admin": { en: "Admin panel", bn: "অ্যাডমিন প্যানেল" },
  "account.logout": { en: "Log out", bn: "লগ আউট" },

  // Mini cart
  "cart.title": { en: "Your cart", bn: "আপনার কার্ট" },
  "cart.empty": { en: "Your cart is empty", bn: "কার্ট খালি" },
  "cart.emptyText": {
    en: "You haven't added anything yet.",
    bn: "এখনো কোনো প্রোডাক্ট যোগ করেননি।",
  },
  "cart.shop": { en: "Shop controllers", bn: "কন্ট্রোলার দেখুন" },
  "cart.subtotal": { en: "Subtotal", bn: "সাবটোটাল" },
  "cart.total": { en: "Total", bn: "মোট" },
  "cart.delivery": { en: "Delivery", bn: "ডেলিভারি" },
  "cart.free": { en: "FREE", bn: "ফ্রি" },
  "cart.addMore": {
    en: "Add {amount} more for free delivery",
    bn: "ফ্রি ডেলিভারির জন্য আরও {amount} যোগ করুন",
  },
  "cart.unlocked": {
    en: "You've unlocked free delivery",
    bn: "ফ্রি ডেলিভারি আনলক হয়েছে",
  },
  "cart.viewcart": { en: "View cart", bn: "কার্ট দেখুন" },
  "cart.checkout": { en: "Checkout", bn: "চেকআউট করুন" },
  "cart.remove": { en: "Remove", bn: "সরান" },
  "cart.close": { en: "Close cart", bn: "কার্ট বন্ধ করুন" },
  "cart.decrease": { en: "Decrease quantity", bn: "পরিমাণ কমান" },
  "cart.increase": { en: "Increase quantity", bn: "পরিমাণ বাড়ান" },
  "cart.qty": { en: "Qty", bn: "পরিমাণ" },

  // Mobile drawer
  "drawer.shop": { en: "Shop", bn: "শপ" },
  "drawer.account": { en: "Account", bn: "অ্যাকাউন্ট" },
  "drawer.support": { en: "Support", bn: "সাপোর্ট" },
  "drawer.whatsapp": { en: "WhatsApp support", bn: "WhatsApp সাপোর্ট" },
  "drawer.call": { en: "Call us", bn: "কল করুন" },
};

function readStoredLang(): Lang {
  try {
    return localStorage.getItem(KEY) === "bn" ? "bn" : "en";
  } catch {
    return "en";
  }
}

let current: Lang = readStoredLang();

if (typeof document !== "undefined") {
  document.documentElement.lang = current === "bn" ? "bn" : "en";
}

export function getLang(): Lang {
  return current;
}

export function setLang(next: Lang): void {
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage unavailable — keep the in-memory value */
  }
  document.documentElement.lang = next === "bn" ? "bn" : "en";
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const entry = DICT[key];
  let text = entry ? entry[current] : key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}
