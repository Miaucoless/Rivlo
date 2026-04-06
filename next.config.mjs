import withPWA, { runtimeCaching } from '@ducanh2912/next-pwa'

const runtimeCachingWithoutDocumentRoutes = runtimeCaching.filter((entry) => {
  const cacheName = entry.options?.cacheName
  return (
    cacheName !== 'start-url' &&
    cacheName !== 'pages' &&
    cacheName !== 'pages-rsc' &&
    cacheName !== 'pages-rsc-prefetch'
  )
})

const disablePwa = process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview'

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
}

export default withPWA({
  cacheStartUrl: false,
  dynamicStartUrl: false,
  dest: 'public',
  register: false,
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  disable: disablePwa,
  publicExcludes: [
    '!icons/apple-splash-*.png',
    '!icons/icon-*.webp',
  ],
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: runtimeCachingWithoutDocumentRoutes,
  },
})(nextConfig)
