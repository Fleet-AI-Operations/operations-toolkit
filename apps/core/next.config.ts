import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/types', '@repo/api-utils', '@repo/ui'],
  serverExternalPackages: ['@repo/database', '@repo/auth', '@repo/core', '@prisma/client', 'pg', '@supabase/ssr'],
};

export default nextConfig;
