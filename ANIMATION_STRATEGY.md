# NexusPlay — Professional Animation Strategy

> A comprehensive plan for unique, high-end animations inspired by Apple, Nike, Stripe, Linear, and Vercel.

---

## 🎯 Design Philosophy

**Core Principle:** *Animation as communication, not decoration.*

Every animation must:
- **Guide attention** — Direct users to what matters
- **Provide feedback** — Confirm actions, show state changes
- **Reveal hierarchy** — Show relationships between elements
- **Feel inevitable** — Natural physics, not arbitrary motion
- **Respect preferences** — `prefers-reduced-motion` always honored

**Signature Feel:** "Nike meets gaming" — bold, kinetic, precise. Sharp easing, 3D depth, staggered choreography.

---

## 📐 Animation Categories

### 1. Entrance Choreography (Page Load)
**Purpose:** Establish spatial hierarchy, brand personality

| Element | Animation | Timing | Easing |
|---------|-----------|--------|--------|
| Hero content | 3D perspective slide + text stagger | 850ms | `cubic-bezier(0.2, 0.8, 0.3, 1)` |
| Featured tiles | Staggered 3D lift (perspective) | 650ms each, 70ms stagger | Same |
| Trending cards | Scale + rotateX entrance | 600ms each, 60ms stagger | Same |
| Category tiles | RotateY flip + translateY | 500ms each, 50ms stagger | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Rails (bestsellers/savings) | Horizontal slide + fade | 700ms | `cubic-bezier(0.2, 0.8, 0.3, 1)` |

**Rule:** All entrances complete within **2.5s**. User can interact immediately (no blocking).

---

### 2. Scroll-Reveal System (Current + Enhanced)
**Current:** Basic `perspective(900px) translate3d(0, 30px, -60px) rotateX(6deg)` with stagger

**Enhanced Variants:**

| Context | Transform | Use Case |
|---------|-----------|----------|
| **Section headers** | `translateY(40px) rotateX(-8deg) scale(0.95)` | Heroic entrance |
| **Product cards** | `translate3d(0, 50px, -80px) rotateX(10deg)` | 3D "rising from depth" |
| **Tiles/Cards** | `translateY(30px) rotateX(6deg)` | Current — keep |
| **Text blocks** | `translateY(20px) + opacity` | Subtle, readable |
| **CTA buttons** | `translateY(16px) scale(0.92)` | Invites click |
| **Stats/Numbers** | Counter animation + `translateY` | Data emphasis |

**Stagger Logic:**
- Batch size: 6 items max per viewport entry
- Delay: 60ms between items
- Direction-aware: items entering from bottom stagger up; from sides stagger in

---

### 3. Micro-Interactions (Hover, Focus, Press)

#### Buttons & Interactive Elements
```css
/* Current: 3D lift on hover */
transform: translateY(-3px) rotateX(9deg) translateZ(6px);

/* Enhanced: Add press ripple + magnetic pull */
--press-scale: 0.96;
--magnetic-radius: 24px;  /* cursor pull towards center */
```

#### Product Cards (3D Tilt)
**Current:** ±8° tilt on mousemove, shadow follows

**Enhanced:**
- **Entrance:** Card "settles" from 15° rotation → 0° over 400ms
- **Hover:** Tilt + scale(1.02) + glow intensify
- **Press:** Flatten (0°) + scale(0.98) — instant feedback
- **Magnetic:** Cursor within 40px pulls card center

#### Navigation
- **Mega menu:** Staggered child reveal (80ms/item) with `rotateX` origin top
- **Mobile drawer:** 3D panel slide (`rotateY(-15deg) translateX(100%)` → `0`)
- **Logo:** Subtle 3D rotate on hover (brand moment)

---

### 4. State Transitions

#### Cart / Mini-Cart
| State | Animation |
|-------|-----------|
| Open | Slide down + `rotateX(-8deg)` origin top, 300ms |
| Close | Reverse, 200ms |
| Item add | New item: `translateY(-20px) scale(0.9) → 0`, badge pulse |
| Item remove | `translateX(30px) rotateY(20deg) fade`, 250ms |
| Qty change | Number counter + button scale pulse |

#### Checkout Steps
- **Step transition:** Horizontal slide (300ms) + step indicator morph
- **Payment method switch:** Cross-fade panels (150ms)
- **bKash TrxID field:** Expand from collapsed (250ms)

#### Product Page
- **Image gallery:** 3D cube transition between images
- **Color select:** Ring expand + label fade (150ms)
- **Add to cart:** Button morphs to checkmark → resets (800ms total)

---

### 5. Page Transitions (MPA-Style)

Since this is a multi-page app (Vite MPA), use **view transitions API** for seamless feel:

```ts
// In main.ts - wrap navigation
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="/"]');
  if (!link || link.target === '_blank') return;
  
  e.preventDefault();
  const url = link.href;
  
  document.documentElement.style.viewTransitionName = 'page';
  
  if (!document.startViewTransition) {
    location.href = url;
    return;
  }
  
  document.startViewTransition(() => {
    location.href = url;
  });
});
```

**Transition Types:**
| From → To | Animation |
|-----------|-----------|
| Any → Product | Shared element (image) morph + slide |
| Home → Shop | Hero content cross-fade, grid staggers in |
| Cart → Checkout | Slide left, form fields cascade in |
| Any → Admin | Fade + scale (authoritative feel) |

---

### 6. Data-Driven & Feedback Animations

#### Loading States
- **Skeleton shimmer:** Current `.p-skeleton` — enhance with directional flow
- **Progressive images:** Blur-up (LQIP → HQ) with 3D scale reveal
- **Search/typeahead:** Results dropdown `translateY(-8px) scale(0.98) → 0`

#### Success/Error Feedback
- **Toast:** 3D slide from top-right (`rotateX(-10deg) translateY(-20px)`)
- **Form validation:** Field shake (horizontal) + border color morph
- **Order confirmed:** Confetti burst (CSS-only, reduced-motion safe)

---

## 🏗 Implementation Architecture

### File Structure
```
frontend/src/
├── animations/
│   ├── core/
│   │   ├── engine.ts           # Animation orchestrator
│   │   ├── easings.ts          # Custom cubic-bezier curves
│   │   ├── reduced-motion.ts   # Central opt-out
│   │   └── performance.ts      # RAF scheduler, will-change mgmt
│   ├── entrance/
│   │   ├── page-choreography.ts
│   │   └── stagger-utils.ts
│   ├── scroll/
│   │   ├── scroll-reveal.ts    # Enhanced IntersectionObserver
│   │   ├── parallax-layers.ts  # Multi-layer scroll parallax
│   │   └── scroll-trigger.ts   # GSAP-like timeline triggers
│   ├── interaction/
│   │   ├── magnetic.ts         # Cursor attraction
│   │   ├── tilt-3d.ts          # Unified 3D card tilt
│   │   ├── press-ripple.ts     # Material-style ripple
│   │   └── magnetic-tilt.ts    # Combined magnetic + 3D
│   ├── transitions/
│   │   ├── view-transitions.ts # MPA view transitions
│   │   ├── shared-element.ts   # Hero image morph
│   │   └── page-morph.ts       # Layout morphing
│   └── feedback/
│       ├── toast-3d.ts
│       ├── counter.ts
│       └── confetti.ts
├── components/
│   └── ... (consume animation hooks)
└── styles/
    ├── _animations-core.scss   # Keyframes, mixins, CSS vars
    ├── _entrance.scss
    ├── _scroll-reveal.scss
    ├── _interactions.scss
    └── _transitions.scss
```

### CSS Architecture (BEM + CSS Variables)
```scss
// _animations-core.scss
:root {
  // Timing
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.2, 0.8, 0.3, 1);
  --ease-sharp: cubic-bezier(0.4, 0, 0.2, 1);
  
  // Duration tokens
  --dur-instant: 80ms;
  --dur-fast: 150ms;
  --dur-base: 250ms;
  --dur-smooth: 400ms;
  --dur-heroic: 800ms;
  
  // 3D
  --perspective-shallow: 600px;
  --perspective-medium: 1100px;
  --perspective-deep: 1500px;
}

// Utility classes
.animate-reveal { /* base */ }
.animate-reveal--section-head { /* variant */ }
.animate-reveal--card { /* variant */ }
.animate-magnetic { /* magnetic cursor */ }
.animate-tilt-3d { /* 3D tilt */ }
```

### JavaScript Patterns
```ts
// animations/core/engine.ts
export const animationEngine = {
  // RAF-based scheduler for coordinated animations
  schedule: (fn: FrameCallback, priority: 'high' | 'normal' | 'low') => id,
  cancel: (id: number) => void,
  
  // Batch DOM reads/writes
  measure: (fn: () => void) => void,
  mutate: (fn: () => void) => void,
  
  // will-change management
  promote: (el: Element, props: string[]) => () => void, // returns cleanup
};

// Usage in components
import { animationEngine } from '@/animations/core/engine';

export function initProductCardTilt(card: HTMLElement) {
  const cleanup = animationEngine.promote(card, ['transform']);
  
  card.addEventListener('mousemove', (e) => {
    animationEngine.mutate(() => {
      // calculate tilt
      card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
  });
  
  card.addEventListener('mouseleave', () => {
    animationEngine.mutate(() => {
      card.style.transform = 'rotateX(0) rotateY(0)';
    });
    cleanup(); // remove will-change
  });
}
```

---

## 📱 Page-Specific Animation Plans

### Home Page (`/`)
| Section | Entrance | Scroll | Interaction |
|---------|----------|--------|-------------|
| Hero slider | 3D direction-aware (current) | Parallax layers (Three.js) | Mouse tilt (current) |
| Featured tiles | Staggered 3D lift | Reveal variant | Magnetic hover |
| Trending | Staggered scale+rotate | Reveal variant | 3D tilt |
| Bestsellers rail | Horizontal slide | Item stagger on scroll | Card 3D tilt |
| Savings rail | Same | Same | Same |
| Categories | RotateY flip stagger | Reveal | 3D lift |

### Shop Page (`/shop.html`)
| Element | Animation |
|---------|-----------|
| Filter sidebar | Slide from left (300ms) + stagger children |
| Product grid | Staggered 3D entrance (batch of 8) |
| Sort/filter change | Grid items: `translateY(20px) scale(0.95) fade` → new positions (FLIP) |
| Pagination | Page indicator morph, new items slide up |
| Infinite scroll | New batch: same entrance as initial |

### Product Page (`/product.html`)
| Element | Animation |
|---------|-----------|
| Gallery hero | 3D cube transition between images |
| Thumbnails | Horizontal scroll, active center highlight |
| Info column | Staggered reveal (title → price → specs → CTA) |
| Color swatches | Ring expand on select |
| Quantity stepper | Button press scale, number counter |
| Add to cart | Button morph → checkmark → reset |
| Related rail | Horizontal scroll entrance |

### Cart Page (`/cart.html`)
| Element | Animation |
|---------|-----------|
| Page entry | Cart items: staggered slide from right |
| Item remove | `translateX(100%) rotateY(30deg) fade` |
| Qty update | Counter animate, row highlight pulse |
| Promo apply | Success: checkmark morph; Error: shake |
| Summary | Numbers count up on load |

### Checkout Page (`/checkout.html`)
| Element | Animation |
|---------|-----------|
| Step indicator | Active step: pulse + label slide |
| Step change | Panel cross-fade + slide (direction-aware) |
| Payment switch | Radio: ring expand, panel expand/collapse |
| bKash field | Expand from 0 height (250ms) |
| Place order | Button: loading spinner → success checkmark |

### Admin Page (`/admin.html`)
| Element | Animation |
|---------|-----------|
| Stats cards | Staggered count-up + 3D entrance |
| Tables | Row stagger on load, new row slide down |
| Modals | Backdrop blur + panel `scale(0.95) → 1` |
| Status change | Badge morph (color + icon) |

---

## ⚡ Performance Strategy

### 1. GPU Acceleration
```css
/* Only promote when animating */
.will-animate {
  will-change: transform, opacity;
}

/* Auto-remove after animation */
@keyframes remove-will-change {
  to { will-change: auto; }
}
```

### 2. RAF Scheduler
- Batch all transform updates in single RAF
- Separate measure/mutate phases
- Priority lanes: hero (high) > cards (normal) > background (low)

### 3. IntersectionObserver Optimization
- `rootMargin: "0px 0px -10% 0px"` — trigger early
- Unobserve immediately after reveal
- `threshold: 0` for performance

### 4. Reduced Motion
```ts
// Central check — all animations respect this
export const prefersReduced = () => 
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// CSS fallback
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 5. Bundle Size
- **Core:** ~3KB gzipped (easings, scheduler, reduced-motion)
- **Entrance:** ~2KB
- **Scroll:** ~4KB
- **Interactions:** ~5KB
- **Transitions:** ~3KB (view transitions polyfill only when needed)
- **Total:** ~17KB — loaded progressively

---

## 🎨 Unique Signature Animations

These differentiate NexusPlay from generic e-commerce:

### 1. **"Controller Connect" Hero Sequence**
- Hero slider transition mimics controller pairing animation
- Particles flow between slides like Bluetooth sync
- Sound design (optional): subtle UI click on slide change

### 2. **"Specs Unfold" Product Page**
- Specs table rows unfold with `rotateX(90deg) → 0` from top
- Each row: 50ms stagger, creates "reading a manual" feel

### 3. **"Cart Gravity"**
- Added items fall into cart icon with physics (bounce, settle)
- Cart badge: elastic scale with physics spring

### 4. **"Order Confirmed" Celebration**
- Confetti burst from order button
- Page morphs to success state with 3D page flip
- Order number types out character-by-character

### 5. **"Admin Command Center"**
- Stats cards: numbers count up with slot-machine roll
- Tables: rows slide in with `translateX(-100%)` → 0, staggered
- Actions: button press shows ripple + confirmation toast

---

## 📋 Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Animation engine core (scheduler, easings, reduced-motion)
- [ ] CSS variable system + utility classes
- [ ] Enhanced scroll reveal with variants
- [ ] View transitions setup for MPA

### Phase 2: Entrance & Scroll (Week 2)
- [ ] Page choreography system
- [ ] Stagger utilities
- [ ] Home page entrance sequence
- [ ] Shop grid entrance + filter transitions

### Phase 3: Interactions (Week 3)
- [ ] Unified 3D tilt system (cards, tiles, buttons)
- [ ] Magnetic cursor system
- [ ] Press ripple + button 3D states
- [ ] Form feedback animations

### Phase 4: State Transitions (Week 4)
- [ ] Cart/mini-cart animations
- [ ] Checkout step transitions
- [ ] Product page gallery + add-to-cart
- [ ] Toast/notification system

### Phase 5: Signature Moments (Week 5)
- [ ] Hero "controller connect" sequence
- [ ] Specs unfold
- [ ] Cart gravity
- [ ] Order celebration
- [ ] Admin command center

### Phase 6: Polish & Performance (Week 6)
- [ ] Performance audit (Chrome DevTools)
- [ ] Reduced-motion testing
- [ ] Cross-browser (Safari 3D transforms)
- [ ] Mobile performance (iOS Safari)
- [ ] Documentation

---

## 🔧 Developer Experience

### Adding Animations to Components
```ts
// In component file
import { 
  entrance, 
  scrollReveal, 
  tilt3d, 
  magnetic 
} from '@/animations';

export function initProductCard(card: HTMLElement) {
  // Entrance (if static)
  entrance.card(card, { delay: getStaggerDelay(card) });
  
  // Scroll reveal (if below fold)
  scrollReveal(card, { variant: 'card' });
  
  // 3D tilt on hover
  tilt3d(card, { maxAngle: 8, perspective: 1100 });
  
  // Magnetic pull
  magnetic(card, { radius: 40, strength: 0.3 });
}
```

### CSS-First Approach
```scss
// Component styles declare intent
.product-card {
  @include animate-reveal('card');
  @include animate-tilt-3d(8deg, 1100px);
  @include animate-magnetic(40px);
  
  // Custom keyframes if needed
  @include keyframes(card-settle) {
    from { transform: perspective(1100px) rotateX(15deg) translateZ(-40px); }
    to   { transform: none; }
  }
}
```

---

## 📚 References & Inspiration

| Site | Technique to Study |
|------|-------------------|
| **Apple** | Scroll-triggered sequences, product reveals, reduced-motion excellence |
| **Nike** | Bold typography animation, 3D product viewers, kinetic branding |
| **Stripe** | Micro-interactions, button states, form feedback, page transitions |
| **Linear** | Smooth state transitions, drag interactions, command palette |
| **Vercel** | Geometric backgrounds, scroll parallax, entrance choreography |
| **Framer** | Layout animations, shared element transitions, spring physics |
| **Rive/App** | State machine animations, interactive 3D |

---

## ✅ Success Metrics

| Metric | Target |
|--------|--------|
| **CLS (Cumulative Layout Shift)** | < 0.1 |
| **INP (Interaction to Next Paint)** | < 200ms |
| **Animation frame rate** | 60fps sustained |
| **Reduced-motion parity** | 100% functional |
| **Bundle size (animations)** | < 20KB gzipped |
| **Safari compatibility** | All 3D transforms work |

---

*This strategy transforms NexusPlay from "has animations" to "animation-first experience" — where motion communicates brand, guides users, and feels inevitable.*