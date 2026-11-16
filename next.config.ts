import type { NextConfig } from 'next';

// Alamat backend NestJS yang dijangkau server Next.js (lihat .env.local)
const API = process.env.API_URL ?? process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Proxy /api/v1 ke NestJS → satu origin, tanpa masalah CORS, foto profil bisa langsung dimuat
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API}/api/v1/:path*` }];
  },
  async headers() {
    return [{ source: '/(.*)', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'same-origin' }] }];
  },
};

export default nextConfig;
