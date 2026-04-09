/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // wagmi v3/connectors v8 has an optional porto connector that imports
    // 'porto/internal'. This module is not installed by default (it's tree-
    // shaken away at runtime since we only use injected()). Tell webpack to
    // treat it as an empty module so production builds don't fail.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'porto/internal': false,
      'pino-pretty': false,
    }
    return config
  },
}

export default nextConfig
