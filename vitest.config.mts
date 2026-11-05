import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

// 测试需要数据库与 Redis 配置，从 .env.local 加载
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // 计费测试共享同一数据库，需串行执行避免数据互相干扰
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
