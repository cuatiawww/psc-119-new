import type { NextConfig } from "next";

const backendBaseUrl = (
  process.env.SIPKK_BACKEND_BASE_URL ||
  'https://sipkk-new.mediaciptainformasi.co.id'
).replace(/\/+$/, '')

const nextConfig: NextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'sipkk-new.mediaciptainformasi.co.id',
      },
    ],
  },
  serverExternalPackages: ['svg-captcha'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns', 'framer-motion'],
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/dashboard-eoc/api/:path*',
          destination: '/api/:path*',
        },
        {
          source: '/dashboard-eoc/gempa_ntt',
          destination: '/dashboard-eoc/gempa-ntt',
        },
        {
          source: '/dashboard-eoc/gempa_ntt/tv',
          destination: '/dashboard-eoc/gempa-ntt/tv',
        },
        {
          source: '/gempa_ntt',
          destination: '/gempa-ntt',
        },
        {
          source: '/gempa_ntt/tv',
          destination: '/dashboard-eoc/gempa-ntt/tv',
        },
        {
          source: '/gempa-ntt/tv',
          destination: '/dashboard-eoc/gempa-ntt/tv',
        },
        {
          source: '/detail-kejadian/:jenis/:id',
          destination: '/',
        },
        {
          source: '/detail-kejadian/:jenis',
          destination: '/',
        },
      ],
      fallback: [
        // Semua /api/* yang tidak ada dedicated route.ts → proxy ke backend utama (web.php)
        {
          source: '/api/:path*',
          destination: `${backendBaseUrl}/api/:path*`,
        },
      ],
    }
  },
};

export default nextConfig;
