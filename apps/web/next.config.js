const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker: produces .next/standalone for minimal runner image
  output: 'standalone',

  // In a monorepo, node_modules are hoisted to the repo root (../../).
  // Next.js file tracing must start from there so the standalone bundle
  // includes packages like `next` that live outside this app's directory.
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },

  reactStrictMode: true,
  transpilePackages: ['@qa-platform/shared-types', '@qa-platform/shared-utils'],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'figma.com' },
      { protocol: 'https', hostname: '*.figma.com' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '*.amazonaws.com' },
    ],
  },

  webpack: (config) => config,

  async rewrites() {
    const apiBase = process.env.API_GATEWAY_URL || 'http://api-gateway:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
