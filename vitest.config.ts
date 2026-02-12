import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { loadEnv } from 'vite';

/**
 * Vitest Configuration for Turborepo Monorepo
 *
 * Tests are now located in:
 * - packages/core/src/ - business logic tests
 * - packages/auth/src/ - auth tests
 * - packages/database/src/ - database tests
 * - apps/star/src/ - app-specific tests
 *
 * Legacy tests in src/ are deprecated but kept during migration
 */

export default defineConfig(({ mode }) => {
    // Load test environment variables
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [react()],
        test: {
            environment: 'jsdom',
            globals: true,
            setupFiles: './vitest.setup.ts',
            passWithNoTests: true,
            // Include tests from packages and apps
            include: [
                'packages/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
                'apps/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
                // Legacy: Keep src/ tests during migration
                'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
            ],
            exclude: ['e2e/**/*', 'node_modules/**/*', '**/node_modules/**', '**/.next/**', '**/dist/**'],
            env: {
                // Load from .env.test
                ...env,
            },
            coverage: {
                provider: 'v8',
                reporter: ['text', 'json', 'html', 'lcov'],
                exclude: [
                    'node_modules/',
                    '**/__tests__/',
                    '**/*.test.ts',
                    '**/*.spec.ts',
                    '**/*.config.ts',
                    '**/types.ts',
                    'e2e/',
                    'dist/',
                    '.next/',
                    'coverage/',
                    'vitest.setup.ts',
                    '**/proxy.ts',
                ],
                include: [
                    // Shared packages
                    'packages/core/src/**/*.ts',
                    'packages/auth/src/**/*.ts',
                    'packages/database/src/**/*.ts',
                    // Legacy (during migration)
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
                // Legacy alias (keep for now)
                '@': path.resolve(__dirname, './src'),
                // Monorepo aliases
                '@repo/database': path.resolve(__dirname, './packages/database/src'),
                '@repo/auth': path.resolve(__dirname, './packages/auth/src'),
                '@repo/core': path.resolve(__dirname, './packages/core/src'),
                '@repo/types': path.resolve(__dirname, './packages/types/src'),
                '@repo/ui': path.resolve(__dirname, './packages/ui/src'),
                '@repo/api-utils': path.resolve(__dirname, './packages/api-utils/src'),
            },
        },
    };
});
