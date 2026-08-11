/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 14 name for externalizing Prisma (Next 15+ uses top-level serverExternalPackages)
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
};
module.exports = nextConfig;
