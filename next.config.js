/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@awc-ui/react', '@awc-ui/core'],
  // Next.js 14 key (renamed to serverExternalPackages in Next.js 15+)
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
};
module.exports = nextConfig;
