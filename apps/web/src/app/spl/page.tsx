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
import { MemecoinPriceChartSection } from '@/app/memecoin/[mint]/memecoin-price-chart-section';
import { TokenHeader } from '@/app/token/[address]/components/token-header';
import { fetchSolanaMemecoinDetail } from '@/lib/dexscreener-memecoins';
import {
    getForkedFromLabel,
    getSiteForkUrl,
    getSiteXUrl,
    getSplMint,
    SITE_DESCRIPTION,
    SITE_LOGO_SRC,
    SITE_NAME,
    SITE_TICKER,
    SITE_TITLE,
    SITE_TOKEN_NAME,
    SPL_ABOUT_HTML,
    SPL_TOKEN_BASICS_URL,
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

export default async function SplTokenPage() {
    const mint = getSplMint();
    const buyAddress = mint && looksLikeSolanaMintAddress(mint) ? mint : null;
    const live = buyAddress ? await fetchSolanaMemecoinDetail(buyAddress) : null;
    const xUrl = getSiteXUrl();
    const forkUrl = getSiteForkUrl();
    const forkedFromLabel = getForkedFromLabel();
    const displayLogo = SITE_LOGO_SRC;
    const pageMint = buyAddress ?? '11111111111111111111111111111111';
    const dexScreenerUrl =
        live?.dexScreenerUrl ??
        (buyAddress ? `https://dexscreener.com/solana/${encodeURIComponent(buyAddress)}` : null);

    return (
        <TokenPageScaffold
            hideBreadcrumb
            background={
                <TokenPageBackgroundBlur>
                    <Image
                        src={SITE_LOGO_SRC}
                        alt=""
                        width={2000}
                        height={1500}
                        className="absolute inset-0 size-full object-cover blur-[100px] opacity-[0.045]"
                        aria-hidden="true"
                        priority
                    />
                </TokenPageBackgroundBlur>
            }
            displayName={SITE_TOKEN_NAME}
            buyAddress={buyAddress}
            buySymbol={SITE_TICKER}
            buyLogoURI={displayLogo}
            header={
                <TokenHeader
                    address={pageMint}
                    symbol={SITE_TICKER}
                    displayName={SITE_TOKEN_NAME}
                    displayLogoURI={displayLogo}
                    uncroppedLogo
                    showSolanaBadge
                    explorerHref={
                        buyAddress
                            ? `https://solscan.io/token/${encodeURIComponent(buyAddress)}`
                            : SPL_TOKEN_BASICS_URL
                    }
                    explorerAriaLabel={buyAddress ? 'View on Solscan' : 'SPL Token basics'}
                    links={{
                        ...(forkUrl ? { website: forkUrl } : {}),
                        ...(xUrl ? { twitter: xUrl } : {}),
                    }}
                />
            }
            sidebar={
                <TokenPageSidebar
                    buyAddress={buyAddress}
                    buySymbol={SITE_TICKER}
                    buyLogoURI={displayLogo}
                    displayName={SITE_TOKEN_NAME}
                    description={SPL_ABOUT_HTML}
                />
            }
        >
            <MemecoinPriceChartSection
                mint={pageMint}
                symbol={SITE_TICKER}
                tokenName={SITE_TOKEN_NAME}
                logoURI={displayLogo}
                currentPrice={live?.price}
                priceChange24h={live?.priceChange24hPercent}
                marketCap={live?.marketCap ?? null}
            />
            <AssetStatsSection
                mode="variant"
                globalStats={null}
                market={{
                    price: live?.price ?? null,
                    liquidity: live?.liquidityUsd ?? null,
                    volume1hUSD: live?.volume1hUsd ?? null,
                    volume24hUSD: live?.volume24hUsd ?? null,
                    marketCap: live?.marketCap ?? null,
                    fdv: live?.fdv ?? null,
                    totalSupply: live?.totalSupply ?? null,
                    circulatingSupply: live?.circulatingSupply ?? null,
                    holders: live?.holders ?? null,
                    trade1h: live?.trade1h ?? null,
                    trade24h: live?.trade24h ?? null,
                    priceChange24hPercent: live?.priceChange24hPercent ?? null,
                }}
            />

            <section className="space-y-3">
                <h2 className="text-title-md text-text-extra-high text-balance">Links</h2>
                <div className="flex flex-wrap gap-3">
                    <a
                        href={SPL_TOKEN_BASICS_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border-medium bg-white px-4 py-2 text-[14px] font-medium text-text-high transition-colors hover:bg-gray-50"
                    >
                        SPL Token basics
                        <ArrowUpRight className="size-3.5" aria-hidden />
                    </a>
                    {xUrl ? (
                        <a
                            href={xUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-border-medium bg-white px-4 py-2 text-[14px] font-medium text-text-high transition-colors hover:bg-gray-50"
                        >
                            X
                            <ArrowUpRight className="size-3.5" aria-hidden />
                        </a>
                    ) : null}
                    {forkUrl ? (
                        <a
                            href={forkUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-border-medium bg-white px-4 py-2 text-[14px] font-medium text-text-high transition-colors hover:bg-gray-50"
                        >
                            {forkedFromLabel}
                            <ArrowUpRight className="size-3.5" aria-hidden />
                        </a>
                    ) : null}
                    <Link
                        href="/solana"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border-medium bg-white px-4 py-2 text-[14px] font-medium text-text-high transition-colors hover:bg-gray-50"
                    >
                        Solana
                    </Link>
                    <Link
                        href="/#memecoins"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border-medium bg-white px-4 py-2 text-[14px] font-medium text-text-high transition-colors hover:bg-gray-50"
                    >
                        Memecoins
                    </Link>
                    {buyAddress ? (
                        <a
                            href={`https://solscan.io/token/${encodeURIComponent(buyAddress)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-border-medium bg-white px-4 py-2 text-[14px] font-medium text-text-high transition-colors hover:bg-gray-50"
                        >
                            Solscan
                            <ArrowUpRight className="size-3.5" aria-hidden />
                        </a>
                    ) : null}
                    {dexScreenerUrl ? (
                        <a
                            href={dexScreenerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-border-medium bg-white px-4 py-2 text-[14px] font-medium text-text-high transition-colors hover:bg-gray-50"
                        >
                            DexScreener
                            <ArrowUpRight className="size-3.5" aria-hidden />
                        </a>
                    ) : null}
                </div>
            </section>

            <section className="flex items-start gap-3 rounded-2xl border border-border-extra-light bg-gray-50/80 px-4 py-3.5 text-[13px] leading-relaxed text-text-low">
                <Image
                    src={SITE_LOGO_SRC}
                    alt=""
                    width={18}
                    height={18}
                    className="mt-0.5 size-[18px] shrink-0 object-contain opacity-90"
                    aria-hidden
                />
                <p>
                    The Foundation&apos;s Tokens registry listed ~300 verified assets and left memecoins out. This fork
                    put them in the core index. <span className="text-text-medium font-medium">$SPL</span> is that
                    truth, tokenized. Host chain:{' '}
                    <Link href="/solana" className="text-text-medium underline-offset-2 hover:underline">
                        Solana
                    </Link>
                    .
                </p>
            </section>
        </TokenPageScaffold>
    );
}
