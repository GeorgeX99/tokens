import type { Metadata } from 'next';

import { FeaturedSplSection } from '@/components/home/featured-spl-section';
import { MemecoinsHomeSection } from '@/components/home/memecoins-home-section';
import { SiteFooter } from '@/components/site-footer';
import { fetchSolanaMemecoinDetail } from '@/lib/dexscreener-memecoins';
import {
    getSplMint,
    SITE_DESCRIPTION,
    SITE_NAME,
    SITE_TITLE,
} from '@/lib/site-brand';
import { looksLikeSolanaMintAddress } from '@/lib/solana-address';

export const metadata: Metadata = {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    openGraph: {
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        siteName: SITE_NAME,
    },
};

export default async function Home() {
    const mint = getSplMint();
    const buyAddress = mint && looksLikeSolanaMintAddress(mint) ? mint : null;
    const live = buyAddress ? await fetchSolanaMemecoinDetail(buyAddress) : null;

    return (
        <main className="min-h-dvh bg-gradient-to-b from-white via-white to-white relative overflow-x-hidden">
            <FeaturedSplSection
                mint={buyAddress}
                price={live?.price ?? null}
                priceChange24hPercent={live?.priceChange24hPercent ?? null}
                priceChange1hPercent={live?.priceChange1hPercent ?? null}
                marketCap={live?.marketCap ?? null}
            />

            <MemecoinsHomeSection />

            <section className="relative z-10 border-t border-gray-1400/10">
                <div className="mx-auto max-w-7xl px-6">
                    <SiteFooter tone="light" />
                </div>
            </section>
        </main>
    );
}
