import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';

import { AssetStatsSection } from '@/app/[name]/components/asset-stats-section';
import {
    TokenPageBackgroundBlur,
    TokenPageScaffold,
    TokenPageSidebar,
} from '@/app/[name]/components/token-page-shell';
import { TokenHeader } from '@/app/token/[address]/components/token-header';
import { Logo } from '@/components/logo';
import { fetchSolanaMemecoinDetail } from '@/lib/dexscreener-memecoins';
import { normalizeLogoSrc } from '@/lib/normalize-logo-src';
import { looksLikeSolanaMintAddress } from '@/lib/solana-address';
import { MemecoinPriceChartSection } from './memecoin-price-chart-section';

interface MemecoinPageProps {
    params: Promise<{ mint: string }>;
}

export async function generateMetadata({ params }: MemecoinPageProps): Promise<Metadata> {
    const { mint } = await params;
    if (!looksLikeSolanaMintAddress(mint)) return { title: 'Token Not Found' };

    const token = await fetchSolanaMemecoinDetail(mint);
    if (!token) return { title: 'Token Not Found', robots: { index: false, follow: false } };

    return {
        title: `${token.name} (${token.symbol}) | Tokens`,
        description: `${token.name} (${token.symbol}) is a Solana memecoin discovered live via DexScreener — price, liquidity, and volume.`,
        robots: { index: false, follow: false },
    };
}

export default async function MemecoinPage({ params }: MemecoinPageProps) {
    const { mint } = await params;
    if (!looksLikeSolanaMintAddress(mint)) notFound();

    const token = await fetchSolanaMemecoinDetail(mint);
    if (!token) notFound();

    // asOf is display-only; avoid Date.now() in the RSC tree under cacheComponents.
    const asOf = token.pairCreatedAt ?? null;

    const logoURI = token.logoURI ? normalizeLogoSrc(token.logoURI) : undefined;

    return (
        <TokenPageScaffold
            background={
                logoURI ? (
                    <TokenPageBackgroundBlur>
                        <Image
                            src={logoURI}
                            alt=""
                            width={2000}
                            height={1500}
                            className="absolute inset-0 size-full object-cover blur-[100px] opacity-[0.03]"
                            aria-hidden="true"
                        />
                    </TokenPageBackgroundBlur>
                ) : null
            }
            displayName={token.name}
            buyAddress={mint}
            buySymbol={token.symbol}
            buyLogoURI={logoURI}
            header={
                <TokenHeader
                    address={mint}
                    symbol={token.symbol}
                    displayName={token.name}
                    displayLogoURI={logoURI}
                />
            }
            sidebar={
                <TokenPageSidebar
                    buyAddress={mint}
                    buySymbol={token.symbol}
                    buyLogoURI={logoURI}
                    displayName={token.name}
                    description={
                        'Memecoin discovered live via DexScreener. Unlike curated Tokens listings, this is an unmoderated market discovery — always do your own research before trading.'
                    }
                    tokenFeedTerms={[token.symbol, token.name]}
                />
            }
        >
            <MemecoinPriceChartSection
                mint={mint}
                symbol={token.symbol}
                tokenName={token.name}
                logoURI={logoURI}
                currentPrice={token.price}
                priceChange24h={token.priceChange24hPercent}
            />

            <AssetStatsSection
                mode="variant"
                globalStats={null}
                market={{
                    price: token.price,
                    liquidity: token.liquidityUsd,
                    volume24hUSD: token.volume24hUsd,
                    marketCap: token.marketCap,
                    priceChange24hPercent: token.priceChange24hPercent,
                    ...(asOf != null ? { asOf } : {}),
                }}
            />

            <section className="mt-10 space-y-3">
                <h2 className="text-title-md text-text-extra-high text-balance">Links</h2>
                <div className="flex flex-wrap gap-3">
                    <a
                        href={token.dexScreenerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border-medium bg-white px-4 py-2 text-[14px] font-medium text-text-high transition-colors hover:bg-gray-50"
                    >
                        DexScreener
                        <ArrowUpRight className="size-3.5" aria-hidden />
                    </a>
                    <a
                        href={`https://solscan.io/token/${encodeURIComponent(mint)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border-medium bg-white px-4 py-2 text-[14px] font-medium text-text-high transition-colors hover:bg-gray-50"
                    >
                        Solscan
                        <ArrowUpRight className="size-3.5" aria-hidden />
                    </a>
                    <Link
                        href="/?category=memecoins"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border-medium bg-white px-4 py-2 text-[14px] font-medium text-text-high transition-colors hover:bg-gray-50"
                    >
                        All Memecoins
                    </Link>
                </div>
            </section>

            <section className="mt-6 flex items-start gap-2 rounded-2xl border border-border-extra-light bg-gray-50/80 px-4 py-3 text-[13px] leading-relaxed text-text-low">
                <Logo width={16} height={16} className="mt-1 shrink-0 opacity-80" />
                <p>
                    Price candles come from GeckoTerminal for this mint&apos;s top Solana pool (discovered via
                    DexScreener). Market stats are surfaced live from DexScreener and are not part of the curated Tokens
                    registry.
                </p>
            </section>
        </TokenPageScaffold>
    );
}
