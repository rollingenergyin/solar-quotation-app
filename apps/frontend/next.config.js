/** @type {import('next').NextConfig} */
// Proxy /api/* to the Express backend. Uses 127.0.0.1 in dev to avoid IPv6/localhost mismatch.
// NEXT_PUBLIC_API_URL must be the API *origin* only (e.g. http://127.0.0.1:4000), not .../api — we append /api/:path* here.
function backendOrigin() {
  const fallback =
    process.env.NODE_ENV === 'production'
      ? 'https://solar-quotation-app-backend.onrender.com'
      : 'http://127.0.0.1:4000';
  let raw = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '') || fallback;
  if (raw.endsWith('/api')) {
    raw = raw.slice(0, -4);
  }
  return raw;
}

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const origin = backendOrigin();
    return [
      {
        source: '/api/:path*',
        destination: `${origin}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
