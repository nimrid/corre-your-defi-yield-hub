import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendTarget = env.VITE_BACKEND_URL || "http://localhost:4000";

  return ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/tokens-api": {
        target: "https://api.tokens.xyz",
        changeOrigin: true,
        secure: true,
        headers: {
          "x-api-key": env.VITE_TOKENS_API_KEY || "",
        },
        rewrite: (path) => path.replace(/^\/tokens-api/, ""),
      },
    },
  },
  build: {
    // Raise the warning threshold for chunk size (in kB) to reduce noise.
    // This does not change the actual bundling behavior.
    chunkSizeWarningLimit: 2500,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "robots.txt",
        "placeholder.svg",
        "corre_logo.png",
        "corre_logoo.png",
      ],
      manifest: {
        name: "Corre - Earn DeFi Yields & Invest in Capital Markets",
        short_name: "Corre",
        description:
          "Bridge DeFi and traditional finance. Earn yields and invest your USDC in stocks and bonds with Corre.",
        start_url: "/",
        display: "standalone",
        background_color: "#020817",
        theme_color: "#7C3AED",
        icons: [
          {
            src: "/favicon.ico",
            sizes: "48x48",
            type: "image/x-icon",
          },
          {
            src: "/corre_logo.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/corre_logo.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "document",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-cache",
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "script" || request.destination === "style",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "static-resources",
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  });
});
