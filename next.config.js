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
  // Configure headers for Service Worker to prevent redirect issues
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
    ]
  },
}

module.exports = withPWA(nextConfig)
