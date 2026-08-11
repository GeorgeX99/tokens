'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { AnimatedPrice } from '@/components/animated-price';
import { useLiveMemecoinPrice } from '@/hooks/queries/use-live-memecoin-price';
import { formatLargeNumber } from '@/lib/format';
import { trackEvent } from '@/lib/posthog-client';
import { looksLikeSolanaMintAddress } from '@/lib/solana-address';
import { getSplMint, SITE_LOGO_SRC, SITE_TICKER } from '@/lib/site-brand';
import { cn } from '@tokens/ui/cn';

export function HeaderSplPrice({ className }: { className?: string }) {
    const mint = useMemo(() => {
        const configured = getSplMint();
        return configured && looksLikeSolanaMintAddress(configured) ? configured : null;
    }, []);
    const [seedMarketCap, setSeedMarketCap] = useState<number | null>(null);
    const [seedPrice, setSeedPrice] = useState<number | null>(null);

    const live = useLiveMemecoinPrice(mint ?? '', {
        enabled: Boolean(mint),
        seedPrice,
        seedMarketCap,
    });

    // Warm-start from our memecoin API so the chip isn't empty before the first poll.
    useEffect(() => {
        if (!mint) return;

        let cancelled = false;
        void (async () => {
            try {
                const res = await fetch(`/api/memecoins/price?address=${encodeURIComponent(mint)}`, {
                    cache: 'no-store',
                    headers: { Accept: 'application/json' },
                });
                if (!res.ok) return;
                const data = (await res.json()) as {
                    price?: number;
                    marketCap?: number | null;
                };
                if (cancelled) return;
                if (typeof data.price === 'number' && Number.isFinite(data.price) && data.price > 0) {
                    setSeedPrice(data.price);
                }
                if (typeof data.marketCap === 'number' && Number.isFinite(data.marketCap) && data.marketCap > 0) {
                    setSeedMarketCap(data.marketCap);
                }
            } catch {
                // Chip stays on live poll only.
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [mint]);

    if (!mint) return null;

    const marketCap = live.marketCap;
    const label = marketCap != null ? formatLargeNumber(marketCap) : '—';

    return (
        <Link
            href="/spl"
            className={cn(
                'group inline-flex h-9 items-center gap-2 rounded-full border border-border-medium bg-white/80 px-2.5 pr-3 text-[13px] font-semibold text-text-extra-high shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur-sm transition-[colors,transform,border-color] duration-150 hover:border-border-high hover:bg-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-extra-high/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                className,
            )}
            onClick={() =>
                trackEvent('nav_link_clicked', {
                    destination: 'spl',
                    link_url: '/spl',
                    source: 'header_spl_price',
                })
            }
            aria-label={`${SITE_TICKER} market cap ${label}. Open ${SITE_TICKER} page.`}
        >
            <Image
                src={SITE_LOGO_SRC}
                alt=""
                width={20}
                height={20}
                className="size-5 shrink-0 object-contain"
                aria-hidden
            />
            <span className="hidden text-text-medium sm:inline">{SITE_TICKER}</span>
            <AnimatedPrice value={label} className="tabular-nums tracking-tight" enabled={marketCap != null} />
        </Link>
    );
}
