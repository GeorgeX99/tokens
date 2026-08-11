import type { Metadata } from 'next';
import { cacheLife } from 'next/cache';
import { fetchApiApp } from '@/lib/api-app';
import { HeroSection } from './hero-section';
import {
    CodeSandbox,
    type AssetLookupResponse,
    type AssetVariantsResponse,
    type AssetVariantsSnapshot,
} from './code-sandbox';
import { LandingNav } from './landing-nav';
import { LogoBar } from './logo-bar';
import { BenefitsSection } from './benefits-section';
import { IntegratorsSection } from './integrators-section';
import { FinalCta } from './final-cta';

export const metadata: Metadata = {
    title: 'Assets API | Tokens',
    description:
        'One API for every asset on Solana. Resolve, fetch, chart, and search. No stitching, no guessing.',
};

const DEMO_QUERIES = ['tesla', 'bitcoin', 'nvidia', 'gold'] as const;
const DEMO_LIMIT = 8;

function fallbackSnapshot(query: string): AssetVariantsSnapshot {
    const assetId = query;
    return {
        query,
        assetId,
        requestPath: `/api/v1/assets/${encodeURIComponent(assetId)}/variants`,
        status: 503,
        data: { assetId, variants: [] },
    };
}

async function fetchSnapshot(
    query: string,
    limit: number,
): Promise<AssetVariantsSnapshot> {
    try {
        const searchRes = await fetchApiApp(
            `/api/v1/assets/search?q=${encodeURIComponent(query)}&limit=${limit}`,
            { next: { revalidate: 60 } },
        );
        const searchText = await searchRes.text();
        if (!searchRes.ok) return fallbackSnapshot(query);

        const parsedSearch = JSON.parse(searchText) as Partial<AssetLookupResponse>;
        const resolvedAssetId = parsedSearch.results?.[0]?.assetId?.trim() || query;
        const requestPath = `/api/v1/assets/${encodeURIComponent(resolvedAssetId)}/variants`;
        const variantsRes = await fetchApiApp(requestPath, { next: { revalidate: 60 } });
        const variantsText = await variantsRes.text();
        if (!variantsRes.ok) {
            return {
                query,
                assetId: resolvedAssetId,
                requestPath,
                status: variantsRes.status,
                data: { assetId: resolvedAssetId, variants: [] },
            };
        }

        const parsedVariants = JSON.parse(variantsText) as Partial<AssetVariantsResponse>;
        const data: AssetVariantsResponse = {
            assetId: parsedVariants.assetId ?? resolvedAssetId,
            variants: Array.isArray(parsedVariants.variants) ? parsedVariants.variants : [],
        };
        return { query, assetId: resolvedAssetId, requestPath, status: variantsRes.status, data };
    } catch {
        return fallbackSnapshot(query);
    }
}

export default async function AssetsApiPage() {
    'use cache';
    // Whole-page cache replacing the previous `export const revalidate = 60`
    // ('minutes' revalidates every 60s).
    cacheLife('minutes');
    const items = await Promise.all(
        DEMO_QUERIES.map((q) => fetchSnapshot(q, DEMO_LIMIT)),
    );

    return (
        <main className="dark relative min-h-dvh bg-[#0F0F10]">
            <LandingNav />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-[220px] md:h-[252px]"
                style={{
                    background:
                        'linear-gradient(to bottom, rgba(255,255,255,0.02), rgba(255,255,255,0))',
                }}
            />
            <section id="overview" className="relative bg-[#0F0F10]">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 inset-x-0 mx-auto hidden w-full max-w-[1120px] px-6 md:block"
                >
                    <div
                        className="ruler-line-vertical h-full border-x border-[#2c2c2d]"
                        style={{ animationDelay: '800ms' }}
                    />
                </div>
                <div className="mx-auto max-w-7xl px-6 pt-28 pb-12 md:pt-32 md:pb-[72px]">
                    <HeroSection />
                </div>
            </section>
            <section className="bg-[#0F0F10]">
                <div
                    aria-hidden
                    className="ruler-line h-px w-full bg-[#2c2c2d]"
                    style={{ animationDelay: '380ms' }}
                />
                <div className="mx-auto max-w-[1120px] px-6 md:min-h-[700px]">
                    <CodeSandbox items={items} limit={DEMO_LIMIT} />
                </div>
                <div
                    aria-hidden
                    className="ruler-line h-px w-full bg-[#2c2c2d]"
                    style={{ animationDelay: '860ms' }}
                />
                <div className="h-20" />
            </section>
            <LogoBar />
            <BenefitsSection />
            <IntegratorsSection />
            <FinalCta />
        </main>
    );
}
