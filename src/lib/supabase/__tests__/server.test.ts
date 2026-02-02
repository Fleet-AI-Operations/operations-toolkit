
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient, createAdminClient } from '../server';

// Mock using vi.hoisted to ensure proper initialization order
const { mockCookieStore, mockCreateServerClient } = vi.hoisted(() => ({
    mockCookieStore: {
        getAll: vi.fn(),
        set: vi.fn(),
    },
    mockCreateServerClient: vi.fn(),
}));

vi.mock('next/headers', () => ({
    cookies: vi.fn(() => mockCookieStore),
}));

vi.mock('@supabase/ssr', () => ({
    createServerClient: mockCreateServerClient,
}));

describe('Supabase Server Client', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetAllMocks();
        process.env = { ...originalEnv };
        mockCreateServerClient.mockReturnValue({ auth: { getUser: vi.fn() } });
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('createClient', () => {
        it('should create client with SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY', async () => {
            process.env.SUPABASE_URL = 'https://test.supabase.co';
            process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';

            mockCookieStore.getAll.mockReturnValue([]);

            await createClient();

            expect(mockCreateServerClient).toHaveBeenCalledWith(
                'https://test.supabase.co',
                'test-publishable-key',
                expect.objectContaining({
                    cookies: expect.any(Object),
                })
            );
        });

        it('should fall back to NEXT_PUBLIC_* environment variables', async () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://public.supabase.co';
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public-key';

            mockCookieStore.getAll.mockReturnValue([]);

            await createClient();

            expect(mockCreateServerClient).toHaveBeenCalledWith(
                'https://public.supabase.co',
                'public-key',
                expect.any(Object)
            );
        });

        it('should support legacy SUPABASE_ANON_KEY', async () => {
            process.env.SUPABASE_URL = 'https://test.supabase.co';
            process.env.SUPABASE_ANON_KEY = 'legacy-anon-key';

            mockCookieStore.getAll.mockReturnValue([]);

            await createClient();

            expect(mockCreateServerClient).toHaveBeenCalledWith(
                'https://test.supabase.co',
                'legacy-anon-key',
                expect.any(Object)
            );
        });

        it('should prioritize SUPABASE_PUBLISHABLE_KEY over SUPABASE_ANON_KEY', async () => {
            process.env.SUPABASE_URL = 'https://test.supabase.co';
            process.env.SUPABASE_PUBLISHABLE_KEY = 'modern-key';
            process.env.SUPABASE_ANON_KEY = 'legacy-key';

            mockCookieStore.getAll.mockReturnValue([]);

            await createClient();

            expect(mockCreateServerClient).toHaveBeenCalledWith(
                'https://test.supabase.co',
                'modern-key',
                expect.any(Object)
            );
        });

        it('should trim whitespace from environment variables', async () => {
            process.env.SUPABASE_URL = '  https://test.supabase.co  ';
            process.env.SUPABASE_PUBLISHABLE_KEY = '  test-key  ';

            mockCookieStore.getAll.mockReturnValue([]);

            await createClient();

            expect(mockCreateServerClient).toHaveBeenCalledWith(
                'https://test.supabase.co',
                'test-key',
                expect.any(Object)
            );
        });

        it('should remove quotes from environment variables', async () => {
            process.env.SUPABASE_URL = '"https://test.supabase.co"';
            process.env.SUPABASE_PUBLISHABLE_KEY = "'test-key'";

            mockCookieStore.getAll.mockReturnValue([]);

            await createClient();

            expect(mockCreateServerClient).toHaveBeenCalledWith(
                'https://test.supabase.co',
                'test-key',
                expect.any(Object)
            );
        });

        it('should throw error when SUPABASE_URL is missing', async () => {
            process.env.SUPABASE_URL = undefined;
            process.env.NEXT_PUBLIC_SUPABASE_URL = undefined;
            process.env.SUPABASE_PUBLISHABLE_KEY = 'test-key';

            await expect(createClient()).rejects.toThrow(
                'Supabase configuration missing (URL: MISSING'
            );
        });

        it('should throw error when key is missing', async () => {
            process.env.SUPABASE_URL = 'https://test.supabase.co';
            process.env.SUPABASE_PUBLISHABLE_KEY = undefined;
            process.env.SUPABASE_ANON_KEY = undefined;

            await expect(createClient()).rejects.toThrow(
                'Key: MISSING'
            );
        });

        it('should throw error when both URL and key are missing', async () => {
            process.env.SUPABASE_URL = undefined;
            process.env.SUPABASE_PUBLISHABLE_KEY = undefined;

            await expect(createClient()).rejects.toThrow(
                'Supabase configuration missing'
            );
        });

        it('should configure cookie getAll operation', async () => {
            process.env.SUPABASE_URL = 'https://test.supabase.co';
            process.env.SUPABASE_PUBLISHABLE_KEY = 'test-key';

            const mockCookies = [
                { name: 'sb-access-token', value: 'token123' },
                { name: 'sb-refresh-token', value: 'refresh123' },
            ];
            mockCookieStore.getAll.mockReturnValue(mockCookies);

            await createClient();

            const cookieConfig = mockCreateServerClient.mock.calls[0][2];
            const retrievedCookies = cookieConfig.cookies.getAll();

            expect(retrievedCookies).toEqual(mockCookies);
            expect(mockCookieStore.getAll).toHaveBeenCalled();
        });

        it('should configure cookie setAll operation', async () => {
            process.env.SUPABASE_URL = 'https://test.supabase.co';
            process.env.SUPABASE_PUBLISHABLE_KEY = 'test-key';

            mockCookieStore.getAll.mockReturnValue([]);

            await createClient();

            const cookieConfig = mockCreateServerClient.mock.calls[0][2];
            const cookiesToSet = [
                { name: 'sb-access-token', value: 'new-token', options: { httpOnly: true } },
            ];

            cookieConfig.cookies.setAll(cookiesToSet);

            expect(mockCookieStore.set).toHaveBeenCalledWith(
                'sb-access-token',
                'new-token',
                { httpOnly: true }
            );
        });

        it('should handle cookie setting errors gracefully in development', async () => {
            process.env.SUPABASE_URL = 'https://test.supabase.co';
            process.env.SUPABASE_PUBLISHABLE_KEY = 'test-key';
            process.env.NODE_ENV = 'development';

            mockCookieStore.getAll.mockReturnValue([]);
            mockCookieStore.set.mockImplementation(() => {
                throw new Error('Cookie setting failed');
            });

            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await createClient();

            const cookieConfig = mockCreateServerClient.mock.calls[0][2];
            cookieConfig.cookies.setAll([{ name: 'test', value: 'value', options: {} }]);

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '[Supabase] Cookie setting failed:',
                expect.any(Error)
            );

            consoleWarnSpy.mockRestore();
        });

        it('should silently ignore cookie errors in production', async () => {
            process.env.SUPABASE_URL = 'https://test.supabase.co';
            process.env.SUPABASE_PUBLISHABLE_KEY = 'test-key';
            process.env.NODE_ENV = 'production';

            mockCookieStore.getAll.mockReturnValue([]);
            mockCookieStore.set.mockImplementation(() => {
                throw new Error('Cookie setting failed');
            });

            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await createClient();

            const cookieConfig = mockCreateServerClient.mock.calls[0][2];
            cookieConfig.cookies.setAll([{ name: 'test', value: 'value', options: {} }]);

            expect(consoleWarnSpy).not.toHaveBeenCalled();

            consoleWarnSpy.mockRestore();
        });
    });

    describe('createAdminClient', () => {
        it('should create admin client with service role key', async () => {
            process.env.SUPABASE_URL = 'https://test.supabase.co';
            process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

            await createAdminClient();

            expect(mockCreateServerClient).toHaveBeenCalledWith(
                'https://test.supabase.co',
                'service-role-key',
                expect.objectContaining({
                    cookies: expect.any(Object),
                })
            );
        });

        it('should support alternative service key environment variable names', async () => {
            process.env.SUPABASE_URL = 'https://test.supabase.co';
            process.env.SERVICE_ROLE_KEY = 'alt-service-key';

            await createAdminClient();

            expect(mockCreateServerClient).toHaveBeenCalledWith(
                'https://test.supabase.co',
                'alt-service-key',
                expect.any(Object)
            );
        });

        it('should prioritize SUPABASE_SERVICE_ROLE_KEY over alternatives', async () => {
            process.env.SUPABASE_URL = 'https://test.supabase.co';
            process.env.SUPABASE_SERVICE_ROLE_KEY = 'primary-key';
            process.env.SERVICE_ROLE_KEY = 'alt-key';

            await createAdminClient();

            expect(mockCreateServerClient).toHaveBeenCalledWith(
                'https://test.supabase.co',
                'primary-key',
                expect.any(Object)
            );
        });

        it('should throw error when service role key is missing', async () => {
            process.env.SUPABASE_URL = 'https://test.supabase.co';
            process.env.SUPABASE_SERVICE_ROLE_KEY = undefined;
            process.env.SERVICE_ROLE_KEY = undefined;

            await expect(createAdminClient()).rejects.toThrow(
                'Supabase Admin config missing (SUPABASE_SERVICE_ROLE_KEY)'
            );
        });

        it('should throw error when URL is missing', async () => {
            process.env.SUPABASE_URL = undefined;
            process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';

            await expect(createAdminClient()).rejects.toThrow(
                'Supabase Admin config missing'
            );
        });

        it('should warn when service key appears to be an anon key', async () => {
            process.env.SUPABASE_URL = 'https://test.supabase.co';
            process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon.signature';

            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await createAdminClient();

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('appears to be an ANON/PUBLISHABLE key')
            );

            consoleWarnSpy.mockRestore();
        });

        it('should warn when service key appears to be a publishable key', async () => {
            process.env.SUPABASE_URL = 'https://test.supabase.co';
            process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_publishable_test_key';

            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await createAdminClient();

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('appears to be an ANON/PUBLISHABLE key')
            );

            consoleWarnSpy.mockRestore();
        });

        it('should configure admin client with empty cookie handlers', async () => {
            process.env.SUPABASE_URL = 'https://test.supabase.co';
            process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

            await createAdminClient();

            const cookieConfig = mockCreateServerClient.mock.calls[0][2];

            // Admin client should return empty cookies
            expect(cookieConfig.cookies.getAll()).toEqual([]);

            // Admin client setAll should be a no-op
            expect(() => cookieConfig.cookies.setAll([{ name: 'test', value: 'value' }])).not.toThrow();
        });

        it('should trim and clean service role key', async () => {
            process.env.SUPABASE_URL = '  https://test.supabase.co  ';
            process.env.SUPABASE_SERVICE_ROLE_KEY = '  "service-key"  ';

            await createAdminClient();

            expect(mockCreateServerClient).toHaveBeenCalledWith(
                'https://test.supabase.co',
                'service-key',
                expect.any(Object)
            );
        });
    });
});
