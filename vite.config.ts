import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import agents from "agents/vite";

export default defineConfig({
    plugins: [
        react(),
        agents()
    ],
    // 🌟 [핵심 해결책 추가] 프론트-백엔드 간 배관을 개통하는 Proxy 설정! [3.0]
    server: {
        proxy: {
            "/agents": {
                target: "http://localhost:8787", // Wrangler 백엔드 서버 포트 [1.0]
                ws: true // 👈 브라우저의 웹소켓(ws://) 업그레이드 요청을 완벽히 토스해 줍니다! [3.0]
            }
        }
    }
});