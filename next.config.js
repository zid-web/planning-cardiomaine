const withPWA = require("next-pwa")({
  dest: "public",
  // Temporarily disable next-pwa to prevent stale service worker cache issues
  // TODO: Re-enable with proper cache busting strategy after stabilizing the app
  disable: true,
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  // Silence the error about using Webpack config (from next-pwa) with Turbopack
  turbopack: {},
}

module.exports = withPWA(nextConfig)
