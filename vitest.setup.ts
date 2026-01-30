import '@testing-library/jest-dom';
import { loadEnvConfig } from '@next/env';

// Load environment variables for tests
// This loads .env.test, .env.local, and .env files
loadEnvConfig(process.cwd());
