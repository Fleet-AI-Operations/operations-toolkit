import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules/**/*', '**/.next/**', '**/dist/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@repo/database': path.resolve(__dirname, '../../packages/database/src'),
      '@repo/auth': path.resolve(__dirname, '../../packages/auth/src'),
      '@repo/core': path.resolve(__dirname, '../../packages/core/src'),
      '@repo/types': path.resolve(__dirname, '../../packages/types/src'),
      '@repo/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@repo/api-utils': path.resolve(__dirname, '../../packages/api-utils/src'),
    },
  },
});
