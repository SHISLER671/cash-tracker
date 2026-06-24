/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      { source: "/icon-light-32x32.png", destination: "/icon.svg" },
      { source: "/icon-dark-32x32.png", destination: "/icon.svg" },
      { source: "/apple-icon.png", destination: "/icon.svg" },
    ]
  },
}

export default nextConfig
