import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            // NestJS 后端运行在 3100，自带 /api 前缀，不需要 rewrite
            target: 'http://localhost:3100',
            ws: true,
          },
        },
      },
    },
  };
});
