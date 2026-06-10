/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three.js ships ESM add-ons that Next/Turbopack must transpile.
  transpilePackages: ['three'],
};

module.exports = nextConfig;