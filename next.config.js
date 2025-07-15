/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: false,
  distDir: 'out',
  images: {
    unoptimized: true,
  },

}

module.exports = nextConfig