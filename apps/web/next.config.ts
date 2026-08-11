import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // Instant Navigations (Next 16.3): explicit caching via 'use cache' and
    // per-route static shells that prefetch/render instantly on client navs.
    cacheComponents: true,
    partialPrefetching: true,
    transpilePackages: ['@tokens/ui', '@tokens/solana', '@tokens/asset-registry'],
    images: {
        // Many token logos (arweave, IPFS gateways) serve SVG content from
        // extension-less URLs; the optimizer rejects them unless SVG is allowed.
        // The CSP sandbox + attachment disposition keep served SVGs inert.
        dangerouslyAllowSVG: true,
        contentDispositionType: 'attachment',
        contentSecurityPolicy: "default-src 'self'; script-src 'none'; object-src 'none'; sandbox;",
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
            // Dev only: the assets API absolutizes local logo paths against the
            // request origin (e.g. http://localhost:3002/logos/popular/solana.png),
            // so next/image needs localhost allowlisted over plain http.
            ...(process.env.NODE_ENV === 'development'
                ? ([
                      { protocol: 'http', hostname: 'localhost' },
                      { protocol: 'http', hostname: '127.0.0.1' },
                  ] as const)
                : []),
        ],
    },
    experimental: {
        // Route handlers bail out of prerendering by throwing; our proxy's
        // try/catch logs those aborts during build without this.
        hideLogsAfterAbort: true,
        externalDir: true,
        optimizePackageImports: ['@tokens/ui', 'lucide-react', 'symbols-react'],
    },
    // PostHog reverse proxy configuration
    async rewrites() {
        return {
            beforeFiles: [
                // Emptied index: only memecoins remain as a home section.
                { source: '/memecoins', destination: '/' },
                { source: '/memecoins/', destination: '/' },
                // Legacy category URLs collapse to home (Solana + $SPL + memecoins).
                { source: '/majors', destination: '/' },
                { source: '/majors/', destination: '/' },
                { source: '/currencies', destination: '/' },
                { source: '/currencies/', destination: '/' },
                { source: '/stables', destination: '/' },
                { source: '/stables/', destination: '/' },
                { source: '/rwas', destination: '/' },
                { source: '/rwas/', destination: '/' },
                { source: '/etfs', destination: '/' },
                { source: '/etfs/', destination: '/' },
                { source: '/metals', destination: '/' },
                { source: '/metals/', destination: '/' },
                { source: '/stocks', destination: '/' },
                { source: '/stocks/', destination: '/' },
            ],
            afterFiles: [
                // Dev only: curated /logos/* assets live in apps/api's public dir.
                // `normalizeLogoSrc` rewrites loopback logo URLs to relative paths;
                // anything not found in our own public dir proxies to the API.
                // (afterFiles = local public/ files win first.)
                ...(process.env.NODE_ENV !== 'production'
                    ? [
                          {
                              source: '/logos/:path*',
                              destination: `${(process.env.API_BASE_URL ?? process.env.TOKENS_API_ORIGIN ?? 'http://localhost:3002').trim().replace(/\/$/, '')}/logos/:path*`,
                          },
                      ]
                    : []),
                {
                    source: '/ingest/static/:path*',
                    destination: 'https://us-assets.i.posthog.com/static/:path*',
                },
                {
                    source: '/ingest/:path*',
                    destination: 'https://us.i.posthog.com/:path*',
                },
            ],
        };
    },
    // Required to support PostHog trailing slash API requests
    skipTrailingSlashRedirect: true,
};

export default nextConfig;
