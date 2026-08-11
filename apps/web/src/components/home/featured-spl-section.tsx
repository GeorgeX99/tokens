'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { IconTriangleFill } from 'symbols-react';

import { Liveline } from 'liveline';

import { AnimatedPrice } from '@/components/animated-price';
import { formatUsdMarketCap, resolveSupplyFromMarketCap } from '@/components/charts/price-chart-utils';
import { InlinePriceChart } from '@/components/inline-price-chart';
import { useInlineLatestClose } from '@/hooks/queries/use-inline-latest-close';
import { useLiveMemecoinPrice } from '@/hooks/queries/use-live-memecoin-price';
import { formatLargeNumber } from '@/lib/format';
import {
    daysForMemecoinDuration,
    intervalsForMemecoinDuration,
} from '@/lib/memecoin-trending';
import { trackEvent } from '@/lib/posthog-client';
import {
    SITE_LOGO_SRC,
    SITE_TICKER,
    SITE_TOKEN_NAME,
} from '@/lib/site-brand';
import { cn } from '@tokens/ui/cn';

export interface FeaturedSplSectionProps {
    mint: string | null;
    price?: number | null;
    priceChange24hPercent?: number | null;
    priceChange1hPercent?: number | null;
    marketCap?: number | null;
}

const HERO_CHART_DURATION = '1h' as const;
const HERO_CHART_DAYS = daysForMemecoinDuration(HERO_CHART_DURATION);
const HERO_CHART_INTERVALS = intervalsForMemecoinDuration(HERO_CHART_DURATION);

/** Hero copy: the idea first. Full fork lore lives on /spl About. */
const ABOUT_BLURB =
    'SPL is Solana’s token standard. Most of what people build are memecoins. $SPL is that truth, tokenized.';

function inferStartPriceFromPercentChange(currentPrice: number, percentChange: number): number | null {
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null;
    if (!Number.isFinite(percentChange)) return null;
    const denom = 1 + percentChange / 100;
    if (!Number.isFinite(denom) || denom === 0) return null;
    const start = currentPrice / denom;
    return Number.isFinite(start) && start > 0 ? start : null;
}

export function FeaturedSplSection({
    mint,
    price,
    priceChange24hPercent,
    priceChange1hPercent,
    marketCap,
}: FeaturedSplSectionProps) {
    const [scrubbedPrice, setScrubbedPrice] = useState<number | null>(null);
    const chartPointerStateRef = useRef<{
        startX: number;
        startY: number;
        isPointerDown: boolean;
        didDrag: boolean;
    }>({ startX: 0, startY: 0, isPointerDown: false, didDrag: false });

    const chartAddress = mint ?? '';
    const href = '/spl';

    const live = useLiveMemecoinPrice(chartAddress, {
        enabled: Boolean(chartAddress),
        seedPrice: price,
        seedMarketCap: marketCap,
    });

    const livePrice = live.price ?? price ?? null;
    const liveMcap = live.marketCap ?? marketCap ?? null;
    const liveChange1h = live.quote?.priceChange1hPercent ?? priceChange1hPercent ?? null;
    const percentChange = liveChange1h ?? priceChange24hPercent ?? 0;
    const safePrice = livePrice ?? 0;
    const supply = useMemo(
        () => resolveSupplyFromMarketCap(liveMcap, livePrice),
        [liveMcap, livePrice],
    );

    const handleScrub = useCallback((next: number | null) => {
        setScrubbedPrice(prev => (prev === next ? prev : next));
    }, []);

    const latestClose = useInlineLatestClose({
        address: chartAddress,
        days: HERO_CHART_DAYS,
        primaryInterval: HERO_CHART_INTERVALS.primary,
        fallbackInterval: HERO_CHART_INTERVALS.fallback,
        preferDexscreener: true,
    });

    const startPrice = useMemo(() => {
        return inferStartPriceFromPercentChange(safePrice, percentChange);
    }, [safePrice, percentChange]);

    const scrubbedPercentChange = useMemo(() => {
        if (scrubbedPrice === null || startPrice === null) return null;
        return ((scrubbedPrice - startPrice) / startPrice) * 100;
    }, [scrubbedPrice, startPrice]);

    const idlePercentChange = useMemo(() => {
        if (latestClose === null || startPrice === null) return percentChange;
        return ((latestClose - startPrice) / startPrice) * 100;
    }, [latestClose, startPrice, percentChange]);

    const effectivePercentChange = scrubbedPercentChange ?? idlePercentChange;
    const isPositive = effectivePercentChange >= 0;
    const effectivePrice = live.realtimePoint?.value ?? latestClose ?? safePrice;
    const displayPrice = scrubbedPrice ?? effectivePrice;
    const isScrubbing = scrubbedPrice != null;

    const displayMcap = useMemo(() => {
        if (supply != null && Number.isFinite(displayPrice) && displayPrice > 0) {
            return displayPrice * supply;
        }
        if (scrubbedPrice == null && liveMcap != null && Number.isFinite(liveMcap) && liveMcap > 0) {
            return liveMcap;
        }
        return null;
    }, [displayPrice, liveMcap, scrubbedPrice, supply]);

    const displayValue = useMemo(() => {
        if (displayMcap == null || !Number.isFinite(displayMcap)) {
            return liveMcap != null ? formatLargeNumber(liveMcap) : '—';
        }
        // Extra precision so 1s price ticks visibly change MCap (not stuck on $1.08M).
        const abs = Math.abs(displayMcap);
        if (abs >= 1_000_000_000) return `$${(abs / 1_000_000_000).toFixed(3)}B`;
        if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(3)}M`;
        if (abs >= 1_000) return `$${(abs / 1_000).toFixed(2)}K`;
        return formatUsdMarketCap(displayMcap);
    }, [displayMcap, liveMcap]);

    const hasLiveMetrics =
        (liveMcap != null && Number.isFinite(liveMcap)) ||
        (livePrice != null && Number.isFinite(livePrice)) ||
        Number.isFinite(percentChange);

    const card = (
        <article className="rounded-[22px] bg-border-light/30 w-full">
            <div className="flex items-center justify-between gap-3 p-3 pl-[24px] py-[10px] pb-0 pr-6">
                {hasLiveMetrics ? (
                    <p
                        className={cn(
                            'inline-flex items-center gap-1 tabular-nums text-[15px] font-medium',
                            isPositive ? 'text-emerald-700' : 'text-red-600',
                        )}
                    >
                        <IconTriangleFill
                            className={cn('size-2.5 fill-current', !isPositive && 'rotate-180')}
                            aria-hidden
                        />
                        {`${Math.abs(effectivePercentChange).toFixed(2)}%`}
                        <span className="font-normal text-text-low">1h</span>
                    </p>
                ) : (
                    <p className="text-[15px] text-text-high">MCap</p>
                )}
                <span className="inline-flex items-center gap-1 text-[15px] font-medium text-text-high">
                    Lore
                    <ArrowRight className="size-3.5" aria-hidden />
                </span>
            </div>

            <div className="mt-3 rounded-[22px] border border-border-medium bg-white p-[24px] md:p-7 hover:ring-2 hover:ring-border-medium/80 transition-[box-shadow,transform] duration-150 ease-out motion-reduce:transition-none active:scale-[0.98]">
                <div
                    className="h-40 md:h-48 w-full"
                    onPointerDown={event => {
                        const state = chartPointerStateRef.current;
                        state.isPointerDown = true;
                        state.didDrag = false;
                        state.startX = event.clientX;
                        state.startY = event.clientY;
                    }}
                    onPointerMove={event => {
                        const state = chartPointerStateRef.current;
                        if (!state.isPointerDown || state.didDrag) return;
                        const dx = Math.abs(event.clientX - state.startX);
                        const dy = Math.abs(event.clientY - state.startY);
                        if (dx >= 6 || dy >= 6) state.didDrag = true;
                    }}
                    onPointerUp={() => {
                        chartPointerStateRef.current.isPointerDown = false;
                    }}
                    onPointerCancel={() => {
                        chartPointerStateRef.current.isPointerDown = false;
                    }}
                    onClick={event => {
                        const state = chartPointerStateRef.current;
                        if (!state.didDrag) return;
                        state.didDrag = false;
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                >
                    {chartAddress ? (
                        <InlinePriceChart
                            address={chartAddress}
                            percentChange24h={percentChange}
                            symbol={SITE_TICKER}
                            className="h-full w-full rounded-sm overflow-hidden bg-transparent relative"
                            chartHeight={140}
                            onScrub={handleScrub}
                            preferDexscreener
                            days={HERO_CHART_DAYS}
                            primaryInterval={HERO_CHART_INTERVALS.primary}
                            fallbackInterval={HERO_CHART_INTERVALS.fallback}
                            fitWindowToData
                            realtimePoint={live.realtimePoint}
                        />
                    ) : (
                        <Liveline
                            data={[]}
                            value={0}
                            window={3600}
                            theme="light"
                            color="#6b7280"
                            grid={false}
                            badge={false}
                            fill={false}
                            loading={true}
                            pulse={false}
                            momentum={false}
                            scrub={false}
                            padding={{ top: 8, right: 8, bottom: 8, left: 8 }}
                            formatTime={() => ''}
                            tooltipY={-1000}
                            tooltipOutline={false}
                            className="w-full h-full"
                            style={{ height: '100%', width: '100%' }}
                        />
                    )}
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[22px] leading-none text-text-extra-high">
                        ${SITE_TICKER}
                    </span>

                    {hasLiveMetrics ? (
                        <AnimatedPrice
                            value={displayValue}
                            enabled={!isScrubbing}
                            className="shrink-0 text-[18px] leading-none font-medium text-text-extra-high"
                        />
                    ) : null}
                </div>
            </div>
        </article>
    );

    return (
        <section className="relative flex min-h-dvh flex-col items-center justify-center px-6 pt-20 pb-16">
            <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
                <Image
                    src={SITE_LOGO_SRC}
                    alt=""
                    width={72}
                    height={72}
                    priority
                    className="size-[56px] md:size-[72px] object-contain"
                    aria-hidden
                />
                <h1 className="mt-4 text-balance text-[28px] md:text-[34px] leading-[1.1] font-medium text-text-extra-high">
                    {SITE_TOKEN_NAME}
                </h1>
                <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-text-medium text-pretty">
                    {ABOUT_BLURB}
                </p>

                <div className="mt-8 w-full text-left">
                    <Link
                        href={href}
                        className="block cursor-pointer"
                        aria-label={`View ${SITE_TOKEN_NAME} lore`}
                        onClick={() =>
                            trackEvent('highlight_clicked', {
                                highlight_type: 'featured_spl',
                                card_id: 'featured-spl',
                                ...(mint ? { token_address: mint } : {}),
                                token_symbol: SITE_TICKER,
                                link_url: href,
                                source: 'home_featured_spl',
                            })
                        }
                    >
                        {card}
                    </Link>
                </div>
            </div>

            <button
                type="button"
                aria-label="Scroll to explore"
                className="absolute bottom-5 left-1/2 -translate-x-1/2 inline-flex flex-col items-center gap-1 text-text-low transition-colors hover:text-text-medium"
                onClick={() => {
                    trackEvent('nav_link_clicked', {
                        destination: 'memecoins',
                        link_url: '/',
                        source: 'home_hero_scroll',
                    });
                    document.getElementById('memecoins')?.scrollIntoView({ behavior: 'smooth' });
                }}
            >
                <span className="text-[12px] font-medium tracking-wide">Explore</span>
                <ChevronDown
                    className="size-5 animate-bounce motion-reduce:animate-none"
                    aria-hidden
                />
            </button>
        </section>
    );
}
