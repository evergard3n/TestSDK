import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // tất cả request tới /api sẽ forward sang BE
      "/api": {
        target: "https://dev-2025.motionbank.net", // backend
        changeOrigin: true,  // sửa host header để giống domain BE
        secure: false,       // nếu BE là https self-signed
      },
    },
  },

});
