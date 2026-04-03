/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://solar-quotation-app-backend.onrender.com/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
