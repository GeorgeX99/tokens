'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AnimatedPrice } from '@/components/animated-price';
import { SolanaLogo } from '@/components/icons';
import { useRealtimeQuote } from '@/hooks/use-realtime-quote';
import { formatPrice } from '@/lib/format';
import { trackEvent } from '@/lib/posthog-client';
import { setLiveSpotPrice, useLiveSpotPrice } from '@/lib/realtime-prices/live-spot-store';
import { cn } from '@tokens/ui/cn';

const SOL_QUOTE_KEY = 'solana';

export function HeaderSolPrice({ className }: { className?: string }) {
    const [seedPrice, setSeedPrice] = useState<number | null>(null);

    useRealtimeQuote({
        quoteKey: SOL_QUOTE_KEY,
        coingeckoId: 'solana',
        symbol: 'SOL',
        seedPriceUsd: seedPrice,
    });

    const live = useLiveSpotPrice(SOL_QUOTE_KEY);

    // Warm-start so the chip isn't empty before the first Pyth tick.
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const res = await fetch('/api/v1/assets/solana', { cache: 'no-store' });
                if (!res.ok) return;
                const data = (await res.json()) as {
                    asset?: { canonicalMarket?: { price?: number | null }; stats?: { price?: number | null } };
                    canonicalMarket?: { price?: number | null };
                    stats?: { price?: number | null };
                };
                const price =
                    data.asset?.canonicalMarket?.price ??
                    data.asset?.stats?.price ??
                    data.canonicalMarket?.price ??
                    data.stats?.price ??
                    null;
                if (!cancelled && typeof price === 'number' && Number.isFinite(price) && price > 0) {
                    setSeedPrice(price);
                    setLiveSpotPrice(SOL_QUOTE_KEY, {
                        priceUsd: price,
                        updatedAtMs: Date.now(),
                        source: 'seed',
                    });
                }
            } catch {
                // Chip stays on live/Pyth only.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const priceUsd = live?.priceUsd ?? seedPrice;
    const label = priceUsd != null ? formatPrice(priceUsd) : '—';

    return (
        <Link
            href="/solana"
            className={cn(
                'group inline-flex h-9 items-center gap-2 rounded-full border border-border-medium bg-white/80 px-2.5 pr-3 text-[13px] font-semibold text-text-extra-high shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur-sm transition-[colors,transform,border-color] duration-150 hover:border-border-high hover:bg-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-extra-high/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                className,
            )}
            onClick={() =>
                trackEvent('nav_link_clicked', {
                    destination: 'solana',
                    link_url: '/solana',
                    source: 'header_sol_price',
                })
            }
            aria-label={`Solana price ${label}. Open Solana page.`}
        >
            <span className="flex size-5 items-center justify-center rounded-full bg-[#000]">
                <SolanaLogo className="h-3 w-3 text-white" />
            </span>
            <span className="hidden text-text-medium sm:inline">SOL</span>
            <AnimatedPrice value={label} className="tabular-nums tracking-tight" enabled={priceUsd != null} />
        </Link>
    );
}
