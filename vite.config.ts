import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: false, // 不清空dist目录，因为后端文件也在这里
  },
  server: {
    host: '0.0.0.0', // 允许局域网访问
    port: 5173, // 指定端口
    proxy: {
      '/api': {
        target: process.env.VITE_API_PORT ?
          `http://localhost:${process.env.VITE_API_PORT}` :
          'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  },
  define: {
    // 确保环境变量在构建时可用
    __VITE_API_PORT__: JSON.stringify(process.env.VITE_API_PORT || '3001'),
    __VITE_WS_PORT__: JSON.stringify(process.env.VITE_WS_PORT || '3002'),
  }
})
