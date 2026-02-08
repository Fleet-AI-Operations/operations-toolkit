import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.test') });
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

/**
 * Playwright Configuration for Turborepo Multi-App Testing
 *
 * Tests can run against different apps by using the APP_UNDER_TEST env var:
 * APP_UNDER_TEST=fleet npm run test:e2e
 *
 * Default: Fleet app (most comprehensive features)
 */

const APP_PORTS = {
    user: 3001,
    qa: 3002,
    core: 3003,
    fleet: 3004,
    admin: 3005,
};

// Determine which app to test (default to fleet)
const appUnderTest = (process.env.APP_UNDER_TEST || 'fleet') as keyof typeof APP_PORTS;
const basePort = APP_PORTS[appUnderTest];
const baseURL = `http://localhost:${basePort}`;

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL,
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        // Start the specific app under test
        command: `pnpm turbo run dev --filter=@repo/${appUnderTest}-app`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        // Give the server more time to start with Supabase
        timeout: 120 * 1000,
    },
});
