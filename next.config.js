// next-pwa désactivé temporairement (incompatibilité de dépendances workbox)
// const withPWA = require("next-pwa")({
//   dest: "public",
//   disable: true,
// })

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
}

module.exports = nextConfig
