import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Agentation } from 'agentation';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Toaster } from 'sonner';
import { GoogleAnalytics } from '@/components/google-analytics';
import { Header } from '@/components/header';
import { QueryProvider } from '@/providers/query-provider';
import { SearchVisibilityProvider } from '@/components/search-visibility-provider';
import { SITE_DESCRIPTION, SITE_TITLE } from '@/lib/site-brand';
import './globals.css';

const GA_MEASUREMENT_ID = process.env.NODE_ENV === 'production' ? 'G-CWCQMKEH99' : undefined;

export const metadata: Metadata = {
    title: {
        default: SITE_TITLE,
        template: '%s | SPL',
    },
    description: SITE_DESCRIPTION,
    icons: {
        icon: [
            // SVG first + sizes: 'any' so browsers that support vector favicons
            // (Chrome/Firefox/Edge) render it crisp at every zoom/DPI instead of
            // the fixed-resolution PNG, which the others fall back to.
            { url: '/logos/SPL-Token.svg', type: 'image/svg+xml', sizes: 'any' },
            { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
        ],
        apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
    },
    manifest: '/manifest.json',
};

export const viewport: Viewport = {
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#ffffff' },
        { media: '(prefers-color-scheme: dark)', color: '#1C1C1D' },
    ],
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <head>
                {/* GA loader origin (production only, but the hint is harmless in dev). */}
                <link rel="preconnect" href="https://www.googletagmanager.com" />
                {/* Pyth Hermes realtime price stream (fetch/EventSource → CORS). */}
                <link rel="preconnect" href="https://hermes.pyth.network" crossOrigin="anonymous" />
                <link
                    rel="preload"
                    href="/fonts/InterVariable.woff2"
                    as="font"
                    type="font/woff2"
                    crossOrigin="anonymous"
                />
            </head>
            <body className="font-sans min-h-dvh bg-background antialiased">
                {GA_MEASUREMENT_ID ? <GoogleAnalytics measurementId={GA_MEASUREMENT_ID} /> : null}
                <Suspense fallback={null}>
                    <NuqsAdapter>
                        <QueryProvider>
                            <SearchVisibilityProvider>
                                <Header />
                                {children}
                                <Toaster position="top-center" richColors closeButton />
                                {process.env.NODE_ENV === 'development' && (
                                    <Agentation endpoint="http://localhost:4747" />
                                )}
                            </SearchVisibilityProvider>
                        </QueryProvider>
                    </NuqsAdapter>
                </Suspense>
            </body>
        </html>
    );
}
