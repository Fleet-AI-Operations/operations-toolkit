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
            coverage: {
                provider: 'v8',
                reporter: ['text', 'json', 'html', 'lcov'],
                exclude: [
                    'node_modules/',
                    'src/lib/__tests__/',
                    'src/app/api/__tests__/',
                    '**/*.test.ts',
                    '**/*.spec.ts',
                    '**/*.config.ts',
                    '**/types.ts',
                    'e2e/',
                    'dist/',
                    '.next/',
                    'coverage/',
                    'vitest.setup.ts',
                    'src/proxy.ts',
                ],
                include: [
                    'src/lib/**/*.ts',
                    'src/app/api/**/*.ts',
                ],
                all: true,
                lines: 80,
                functions: 80,
                branches: 75,
                statements: 80,
            },
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
    };
});
