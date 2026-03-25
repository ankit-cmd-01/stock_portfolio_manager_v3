import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "^/accounts(?:/|$)": "http://127.0.0.1:8000",
      "^/portfolio(?:/|$)": "http://127.0.0.1:8000",
      "^/stock_master(?:/|$)": "http://127.0.0.1:8000",
      "^/user_stocks(?:/|$)": "http://127.0.0.1:8000",
      "^/api(?:/|$)": "http://127.0.0.1:8000",
      "^/media(?:/|$)": "http://127.0.0.1:8000",
      "^/admin(?:/|$)": "http://127.0.0.1:8000",
    },
  },
});
