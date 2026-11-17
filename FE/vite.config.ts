import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react()],
    server: {
      port: 5174,
      strictPort: true,
      // 개발 중 /api 요청은 로컬 백엔드(BE, 기본 8080)로 넘긴다. 다른 주소는 FE/.env.local 의
      // API_PROXY_TARGET 으로 바꾼다. 지금 화면은 가상 서버(src/api/mock.ts)를 써서 이 경로를 부르지 않는다.
      proxy: {
        "/api": {
          target: env.API_PROXY_TARGET || "http://localhost:8080",
          changeOrigin: true,
        },
      },
    },
  };
});
