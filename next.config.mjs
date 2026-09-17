/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: false,

  eslint: {
    ignoreDuringBuilds: true,
  },

  allowedDevOrigins: [
    "lung-ppc-nest-andy.trycloudflare.com",
  ],
};

export default nextConfig;