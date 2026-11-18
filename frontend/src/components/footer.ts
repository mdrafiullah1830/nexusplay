// ============================================================
// NEXUSPLAY — Footer component
// ============================================================

export function initFooter(): void {
  const root = document.getElementById("footer-root");
  if (!root) return;

  root.innerHTML = `
    <footer class="footer">
      <div class="footer__grid">
        <div>
          <div class="footer__brand">NexusPlay</div>
          <p class="footer__tagline">
            Gaming controllers and accessories, delivered across Bangladesh. Honest prices, real after-sales
            support.
          </p>
          <div class="footer__contact">
            <a href="https://wa.me/8801782577251">WhatsApp: +880 1782577251</a>
            <a href="tel:+8801782577251">+880 1782577251</a>
            <a href="mailto:gamersgrip73@gmail.com">gamersgrip73@gmail.com</a>
          </div>
        </div>

        <div>
          <div class="footer__col-title">Shop</div>
          <a class="footer__item" href="/shop.html?category=controllers">Controllers</a>
          <a class="footer__item" href="/shop.html?category=keyboards">Keyboards</a>
          <a class="footer__item" href="/shop.html?category=mice">Mice</a>
          <a class="footer__item" href="/shop.html?category=other">Other Items</a>
        </div>

        <div>
          <div class="footer__col-title">Company</div>
          <a class="footer__item" href="#">About Us</a>
          <a class="footer__item" href="/track.html">Track Your Order</a>
          <a class="footer__item" href="https://wa.me/8801782577251">Contact Us</a>
        </div>

        <div>
          <div class="footer__col-title">Support</div>
          <a class="footer__item" href="/track.html">Order Tracking</a>
          <a class="footer__item" href="#">FAQ</a>
          <a class="footer__item" href="#">Warranty</a>
        </div>
      </div>

      <div class="footer__bottom">
        <span>© 2026 NexusPlay. All rights reserved.</span>
        <div class="footer__social">
          <a href="https://www.facebook.com/" target="_blank" rel="noopener">Facebook</a>
          <a href="https://www.instagram.com/" target="_blank" rel="noopener">Instagram</a>
        </div>
      </div>
    </footer>`;
}
