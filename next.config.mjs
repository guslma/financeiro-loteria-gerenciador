import withPWAInit from "@ducanh2912/next-pwa"

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  workboxOptions: {
    runtimeCaching: [
      {
        // Nunca cachear dados financeiros — sempre buscar da rede.
        urlPattern: /^\/api\//,
        handler: "NetworkOnly",
      },
    ],
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  devIndicators: false,
}

export default withPWA(nextConfig)
