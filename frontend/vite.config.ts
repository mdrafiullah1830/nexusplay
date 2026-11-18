import { defineConfig } from "vite";
import { resolve } from "path";

const page = (name: string) => resolve(__dirname, `${name}.html`);

export default defineConfig({
  root: ".",
  server: {
    port: 5173,
    open: false,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: page("index"),
        shop: page("shop"),
        product: page("product"),
        cart: page("cart"),
        checkout: page("checkout"),
        track: page("track"),
        login: page("login"),
        register: page("register"),
        admin: page("admin"),
      },
    },
  },
});
