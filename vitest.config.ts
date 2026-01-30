import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    // Load test environment variables
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [react()],
        test: {
            environment: 'jsdom',
            globals: true,
            setupFiles: './vitest.setup.ts',
            include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
            exclude: ['e2e/**/*', 'node_modules/**/*'],
            env: {
                // Load from .env.test
                ...env,
            },
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
    };
});
